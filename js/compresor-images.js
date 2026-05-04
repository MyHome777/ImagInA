(function () {
  const savedTheme = localStorage.getItem('pulpi_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme:dark)').matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
})();

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('pulpi_theme', theme);
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

const PRESETS = {
  light: {
    label: 'Ligero',
    quality: 0.58,
    maxDimension: 1400,
    minQuality: 0.4,
    downscaleSteps: [1, 0.9, 0.82],
    helper: 'Pensado para bajar fuerte el peso y compartir por correo o mensajeria.'
  },
  balanced: {
    label: 'Balanceado',
    quality: 0.78,
    maxDimension: 2000,
    minQuality: 0.56,
    downscaleSteps: [1, 0.93, 0.86],
    helper: 'Buen equilibrio entre nitidez y tamano. Ideal para uso general.'
  },
  high: {
    label: 'Alta calidad',
    quality: 0.9,
    maxDimension: 2600,
    minQuality: 0.68,
    downscaleSteps: [1, 0.96, 0.9],
    helper: 'Conserva mas detalle visual y reduce menos el peso.'
  }
};

const filesInput = document.getElementById('filesInput');
const dropZone = document.getElementById('dropZone');
const summaryFiles = document.getElementById('summaryFiles');
const summaryOriginal = document.getElementById('summaryOriginal');
const summaryPreset = document.getElementById('summaryPreset');
const summaryOutput = document.getElementById('summaryOutput');
const summaryResize = document.getElementById('summaryResize');
const helperText = document.getElementById('helperText');
const keepDimensions = document.getElementById('keepDimensions');
const fileList = document.getElementById('fileList');
const filesStatus = document.getElementById('filesStatus');
const compressBtn = document.getElementById('compressBtn');
const progressWrap = document.getElementById('progressWrap');
const progressLbl = document.getElementById('progressLbl');
const progressFill = document.getElementById('progressFill');
const resultPanel = document.getElementById('resultPanel');
const resultMessage = document.getElementById('resultMessage');
const resultOriginal = document.getElementById('resultOriginal');
const resultFinal = document.getElementById('resultFinal');
const resultSavings = document.getElementById('resultSavings');
const resultOutput = document.getElementById('resultOutput');
const downloadLink = document.getElementById('downloadLink');
const modal = document.getElementById('customModal');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

let selectedFiles = [];
let selectedPreset = 'balanced';
let selectedFormat = 'image/jpeg';
let isBusy = false;
let downloadUrl = null;
const fileStatuses = new Map();

themeToggleBtn.addEventListener('click', toggleTheme);
window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', function (event) {
  if (!localStorage.getItem('pulpi_theme')) {
    applyTheme(event.matches ? 'dark' : 'light');
  }
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (eventName) {
  dropZone.addEventListener(eventName, function (event) {
    event.preventDefault();
    event.stopPropagation();
  });
});

dropZone.addEventListener('dragenter', function () {
  if (!isBusy) dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragover', function () {
  if (!isBusy) dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', function () {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', function (event) {
  dropZone.classList.remove('dragover');
  if (isBusy) return;
  if (event.dataTransfer.files.length) {
    handleFiles(event.dataTransfer.files);
  }
});

filesInput.addEventListener('change', function () {
  if (this.files.length) {
    handleFiles(this.files);
  }
  this.value = '';
});

document.querySelectorAll('[data-preset]').forEach(function (button) {
  button.addEventListener('click', function () {
    if (isBusy) return;
    selectedPreset = this.getAttribute('data-preset');
    document.querySelectorAll('[data-preset]').forEach(function (item) {
      item.classList.toggle('active', item === button);
    });
    syncSummary();
  });
});

document.querySelectorAll('[data-format]').forEach(function (button) {
  button.addEventListener('click', function () {
    if (isBusy) return;
    selectedFormat = this.getAttribute('data-format');
    document.querySelectorAll('[data-format]').forEach(function (item) {
      item.classList.toggle('active', item === button);
    });
    syncSummary();
  });
});

keepDimensions.addEventListener('change', syncSummary);

compressBtn.addEventListener('click', function () {
  if (isBusy || !selectedFiles.length) return;
  compressImages();
});

modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', function (event) {
  if (event.target === modal) closeModal();
});

syncSummary();
renderFiles();

function handleFiles(files) {
  const validFiles = Array.from(files).filter(isImageFile);
  if (!validFiles.length) {
    showModal('Archivos no validos', 'Solo se permiten imagenes PNG, JPG, JPEG o WEBP.');
    return;
  }

  selectedFiles = validFiles;
  fileStatuses.clear();
  validFiles.forEach(function (file) {
    fileStatuses.set(file.name + '__' + file.size, { text: 'Lista', state: '' });
  });
  cleanupDownloadUrl();
  resultPanel.style.display = 'none';
  renderFiles();
  syncSummary();
}

function syncSummary() {
  const preset = PRESETS[selectedPreset];
  const originalTotal = selectedFiles.reduce(function (sum, file) { return sum + file.size; }, 0);

  summaryFiles.textContent = selectedFiles.length + ' imagen' + (selectedFiles.length === 1 ? '' : 'es');
  summaryOriginal.textContent = formatBytes(originalTotal);
  summaryPreset.textContent = 'Preset activo: ' + preset.label;
  summaryOutput.textContent = formatLabel(selectedFormat);
  summaryResize.textContent = keepDimensions.checked
    ? 'Se conserva el tamano original'
    : 'Redimensionado inteligente activado';
  helperText.textContent = preset.helper + (selectedFormat === 'image/png'
    ? ' En PNG puede no haber tanto ahorro como en JPEG o WEBP.'
    : selectedFormat === 'image/webp'
      ? ' WEBP suele producir archivos mas ligeros que JPEG.'
      : ' JPEG es el formato mas compatible para fotos.') +
    ' Si recomprimir una imagen la empeora, se conserva la mejor version disponible.';

  compressBtn.disabled = !selectedFiles.length || isBusy;
}

function renderFiles() {
  fileList.innerHTML = '';
  if (!selectedFiles.length) {
    fileList.innerHTML = '<div class="file-item"><div class="file-icon"><i class="fa-solid fa-image"></i></div><div class="file-meta"><span class="file-name">Aun no has seleccionado imagenes</span><span class="file-size">Carga una o varias fotos para comenzar.</span></div><div class="file-status">Esperando</div></div>';
    filesStatus.textContent = '0 listas';
    return;
  }

  filesStatus.textContent = selectedFiles.length + ' en cola';
  selectedFiles.forEach(function (file) {
    const key = file.name + '__' + file.size;
    const status = fileStatuses.get(key) || { text: 'Lista', state: '' };
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML =
      '<div class="file-icon"><i class="fa-solid fa-image"></i></div>' +
      '<div class="file-meta">' +
        '<span class="file-name">' + escapeHtml(file.name) + '</span>' +
        '<span class="file-size">' + formatBytes(file.size) + '</span>' +
      '</div>' +
      '<div class="file-status ' + status.state + '">' + escapeHtml(status.text) + '</div>';
    fileList.appendChild(item);
  });
}

async function compressImages() {
  isBusy = true;
  syncSummary();
  cleanupDownloadUrl();
  resultPanel.style.display = 'none';
  progressWrap.style.display = 'block';
  progressFill.style.width = '0%';

  try {
    const preset = PRESETS[selectedPreset];
    const results = [];
    let originalTotal = 0;
    let compressedTotal = 0;

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      const key = file.name + '__' + file.size;
      originalTotal += file.size;
      setFileStatus(key, 'Comprimiendo...', 'working');
      progressLbl.textContent = 'Procesando ' + (index + 1) + ' de ' + selectedFiles.length + '...';
      progressFill.style.width = Math.round(((index + 1) / selectedFiles.length) * 90) + '%';

      const result = await compressSingleImage(file, preset, selectedFormat, keepDimensions.checked);
      results.push(result);
      compressedTotal += result.blob.size;

      if (result.usedOriginal) {
        setFileStatus(key, 'Ya estaba optimizada', 'warning');
      } else if (result.blob.size < file.size) {
        setFileStatus(key, formatBytes(file.size) + ' -> ' + formatBytes(result.blob.size), 'success');
      } else {
        setFileStatus(key, 'Sin ahorro notable', 'warning');
      }
    }

    progressLbl.textContent = selectedFiles.length === 1 ? 'Preparando descarga...' : 'Empaquetando ZIP...';
    progressFill.style.width = '100%';
    const packageResult = await buildPackage(results);

    downloadUrl = URL.createObjectURL(packageResult.blob);
    downloadLink.href = downloadUrl;
    downloadLink.download = packageResult.filename;
    resultOriginal.textContent = formatBytes(originalTotal);
    resultFinal.textContent = formatBytes(compressedTotal);
    resultSavings.textContent = originalTotal > compressedTotal
      ? (((originalTotal - compressedTotal) / originalTotal) * 100).toFixed(1) + '%'
      : '0%';
    resultOutput.textContent = packageResult.label;
    resultMessage.textContent = buildResultMessage(results, Math.max(0, packageResult.blob.size - compressedTotal));
    downloadLink.innerHTML = packageResult.filename.endsWith('.zip')
      ? '<i class="fa-solid fa-file-zipper"></i> Descargar ZIP comprimido'
      : results.length === 1 && results[0].usedOriginal
        ? '<i class="fa-solid fa-download"></i> Descargar mejor version'
        : '<i class="fa-solid fa-download"></i> Descargar imagen comprimida';
    resultPanel.style.display = 'block';
  } catch (error) {
    console.error(error);
    showModal('No se pudo comprimir', 'Ocurrio un error al procesar las imagenes. Intenta con menos archivos o usa otro formato.');
  } finally {
    isBusy = false;
    syncSummary();
    setTimeout(function () {
      progressWrap.style.display = 'none';
    }, 700);
  }
}

async function compressSingleImage(file, preset, format, keepOriginalSize) {
  const image = await loadImage(file);
  try {
    const baseDimensions = getBaseDimensions(image.width, image.height, preset.maxDimension, keepOriginalSize);
    const dimensionScales = getDimensionScales(baseDimensions.width, baseDimensions.height, preset, keepOriginalSize);
    const qualitySteps = buildQualitySteps(preset, format);
    let bestCandidate = null;

    for (let i = 0; i < dimensionScales.length; i += 1) {
      const scale = dimensionScales[i];
      const dimensions = scaleDimensions(baseDimensions.width, baseDimensions.height, scale);
      const canvas = drawImageToCanvas(image, dimensions.width, dimensions.height, format);

      for (let j = 0; j < qualitySteps.length; j += 1) {
        const quality = qualitySteps[j];
        const blob = await canvasToBlob(canvas, format, quality);

        if (!bestCandidate || blob.size < bestCandidate.blob.size) {
          bestCandidate = {
            blob: blob,
            width: dimensions.width,
            height: dimensions.height,
            quality: quality
          };
        }
      }
    }

    if (!bestCandidate || bestCandidate.blob.size >= file.size * 0.995) {
      return {
        blob: file,
        filename: file.name,
        outputFormat: normalizeImageFormat(file.type),
        usedOriginal: true
      };
    }

    return {
      blob: bestCandidate.blob,
      filename: buildOutputName(file.name, getExtension(format)),
      outputFormat: format,
      usedOriginal: false
    };
  } finally {
    URL.revokeObjectURL(image.src);
  }
}

async function buildPackage(results) {
  if (results.length === 1) {
    return {
      blob: results[0].blob,
      filename: results[0].filename,
      label: results[0].usedOriginal ? 'Original' : formatLabel(results[0].outputFormat)
    };
  }

  const zip = new JSZip();
  const usedNames = new Set();

  results.forEach(function (result, index) {
    const name = ensureUniqueName(result.filename, usedNames, index + 1);
    zip.file(name, result.blob);
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    blob: blob,
    filename: 'PulpiTools_Imagenes_Comprimidas.zip',
    label: results.length + ' archivos'
  };
}

function loadImage(file) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = function () { resolve(image); };
    image.onerror = function (error) {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

function getBaseDimensions(width, height, maxDimension, keepOriginalSize) {
  let targetWidth = width;
  let targetHeight = height;

  if (!keepOriginalSize) {
    const maxSide = Math.max(targetWidth, targetHeight);
    if (maxSide > maxDimension) {
      const scale = maxDimension / maxSide;
      targetWidth = Math.max(1, Math.round(targetWidth * scale));
      targetHeight = Math.max(1, Math.round(targetHeight * scale));
    }
  }

  return { width: targetWidth, height: targetHeight };
}

function getDimensionScales(width, height, preset, keepOriginalSize) {
  if (keepOriginalSize) {
    return [1];
  }

  const largestSide = Math.max(width, height);
  if (largestSide < 1400) {
    return [1];
  }

  return preset.downscaleSteps.slice();
}

function scaleDimensions(width, height, scale) {
  if (scale === 1) {
    return { width: width, height: height };
  }

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function buildQualitySteps(preset, format) {
  if (format === 'image/png') {
    return [undefined];
  }

  const start = preset.quality;
  const floor = preset.minQuality;
  const steps = [start, start - 0.08, start - 0.16, start - 0.24, floor]
    .filter(function (value) {
      return Number.isFinite(value) && value > 0.32 && value <= 0.95;
    })
    .map(function (value) {
      return Number(value.toFixed(2));
    });

  return Array.from(new Set(steps));
}

function drawImageToCanvas(image, width, height, format) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  if (format === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, format, quality) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (!blob) {
        reject(new Error('No se pudo generar el blob final.'));
        return;
      }
      resolve(blob);
    }, format, quality);
  });
}

function setFileStatus(key, text, state) {
  fileStatuses.set(key, { text: text, state: state });
  renderFiles();
}

function buildOutputName(originalName, extension) {
  const cleanBase = originalName.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'imagen';
  return cleanBase + '_PulpiTools_comprimida.' + extension;
}

function ensureUniqueName(name, usedNames, index) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const extensionIndex = name.lastIndexOf('.');
  const base = extensionIndex >= 0 ? name.slice(0, extensionIndex) : name;
  const ext = extensionIndex >= 0 ? name.slice(extensionIndex) : '';
  let counter = index;
  let candidate = base + '_' + counter + ext;

  while (usedNames.has(candidate)) {
    counter += 1;
    candidate = base + '_' + counter + ext;
  }

  usedNames.add(candidate);
  return candidate;
}

function cleanupDownloadUrl() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
}

function buildResultMessage(results, packageOverhead) {
  const preservedCount = results.filter(function (item) { return item.usedOriginal; }).length;
  const compressedCount = results.length - preservedCount;

  if (results.length === 1) {
    return preservedCount
      ? 'La imagen ya estaba optimizada. Se conserva el archivo original para no aumentar su peso.'
      : 'La imagen comprimida ya esta lista para descargar.';
  }

  let message = compressedCount === results.length
    ? 'Tus imagenes se comprimieron y se empaquetaron en un ZIP.'
    : 'Se comprimieron ' + compressedCount + ' imagenes. ' + preservedCount + ' ya estaban optimizadas y se conservaron para no aumentar su peso.';

  if (packageOverhead > 4096) {
    message += ' El ZIP final puede variar unos KB por el empaquetado.';
  }

  return message;
}

function formatLabel(format) {
  if (format === 'image/webp') return 'WEBP';
  if (format === 'image/png') return 'PNG';
  return 'JPEG';
}

function getExtension(format) {
  if (format === 'image/webp') return 'webp';
  if (format === 'image/png') return 'png';
  return 'jpg';
}

function isImageFile(file) {
  return file && /^image\/(png|jpeg|jpg|webp)$/i.test(file.type);
}

function normalizeImageFormat(format) {
  if (/image\/webp/i.test(format)) return 'image/webp';
  if (/image\/png/i.test(format)) return 'image/png';
  return 'image/jpeg';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return (index === 0 ? value.toFixed(0) : value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)) + ' ' + units[index];
}

function showModal(title, message, type) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalIcon.className = 'modal-icon ' + (type === 'success' ? 'success' : 'error');
  modal.classList.add('active');
}

function closeModal() {
  modal.classList.remove('active');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
