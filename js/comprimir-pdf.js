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

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const { jsPDF } = window.jspdf;
const { PDFDocument } = PDFLib;

const MODE_PRESETS = {
  safe: {
    label: 'Seguro',
    hintTitle: 'Modo seguro',
    hintText: 'Usa una optimizacion suave para conservar texto, enlaces y estructura siempre que sea posible. El ahorro suele ser menor.',
    note: 'Este modo prioriza mantener el PDF mas intacto. Si el archivo ya estaba optimizado, el ahorro puede ser minimo.',
    output: 'PDF'
  },
  balanced: {
    label: 'Balanceado',
    hintTitle: 'Modo balanceado',
    hintText: 'Reconstruye cada pagina con una compresion visual cuidada para conseguir una reduccion notable sin castigar demasiado la nitidez.',
    note: 'En Balanceado se prioriza la apariencia visual. En algunos PDFs el texto seleccionable puede convertirse en imagen.',
    output: 'PDF'
  },
  strong: {
    label: 'Fuerte',
    hintTitle: 'Modo fuerte',
    hintText: 'Aplica una recompresion mas agresiva para bajar mucho el peso. Funciona mejor con PDFs escaneados, catalogos y documentos con imagenes.',
    note: 'En Fuerte se busca la maxima reduccion posible. Puede suavizar detalles finos y convertir texto en imagen.',
    output: 'PDF'
  }
};

const fileInput = document.getElementById('pdfInput');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const emptyState = document.getElementById('emptyState');
const filesCount = document.getElementById('filesCount');
const compressBtn = document.getElementById('compressBtn');
const compressBtnText = document.getElementById('compressBtnText');
const loadingSpinner = document.getElementById('loadingSpinner');
const progressWrap = document.getElementById('progressWrap');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const resultPanel = document.getElementById('resultPanel');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const resultNote = document.getElementById('resultNote');
const downloadLink = document.getElementById('downloadLink');
const statOriginal = document.getElementById('statOriginal');
const statFinal = document.getElementById('statFinal');
const statSavings = document.getElementById('statSavings');
const statOutput = document.getElementById('statOutput');
const modeHintTitle = document.getElementById('modeHintTitle');
const modeHintText = document.getElementById('modeHintText');
const modal = document.getElementById('customModal');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

let selectedFiles = [];
let activeMode = 'balanced';
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
    addFiles(event.dataTransfer.files);
  }
});

fileInput.addEventListener('change', function () {
  if (this.files.length) {
    addFiles(this.files);
  }
  this.value = '';
});

document.querySelectorAll('.mode-card').forEach(function (button) {
  button.addEventListener('click', function () {
    if (isBusy) return;
    setMode(this.getAttribute('data-mode'));
  });
});

fileList.addEventListener('click', function (event) {
  const removeBtn = event.target.closest('[data-remove-key]');
  if (!removeBtn || isBusy) return;
  removeFile(removeBtn.getAttribute('data-remove-key'));
});

compressBtn.addEventListener('click', function () {
  if (isBusy || !selectedFiles.length) return;
  compressSelectedFiles();
});

modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', function (event) {
  if (event.target === modal) closeModal();
});

setMode(activeMode);
renderFiles();

function addFiles(files) {
  const incoming = Array.from(files).filter(isPdfFile);
  if (!incoming.length) {
    showModal('Archivo no valido', 'Solo se permiten documentos PDF.');
    return;
  }

  const knownKeys = new Set(selectedFiles.map(getFileKey));
  let addedCount = 0;

  incoming.forEach(function (file) {
    const key = getFileKey(file);
    if (!knownKeys.has(key)) {
      selectedFiles.push(file);
      fileStatuses.set(key, { text: 'Listo', state: 'idle' });
      knownKeys.add(key);
      addedCount += 1;
    }
  });

  if (!addedCount) {
    showModal('Sin cambios', 'Esos PDFs ya estaban cargados en la lista.');
    return;
  }

  resetResult();
  renderFiles();
}

function removeFile(key) {
  selectedFiles = selectedFiles.filter(function (file) {
    return getFileKey(file) !== key;
  });
  fileStatuses.delete(key);
  resetResult();
  renderFiles();
}

function renderFiles() {
  filesCount.textContent = selectedFiles.length + ' archivo' + (selectedFiles.length === 1 ? '' : 's');
  fileList.innerHTML = '';

  if (!selectedFiles.length) {
    emptyState.style.display = 'block';
    fileList.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    fileList.style.display = 'flex';
  }

  selectedFiles.forEach(function (file) {
    const key = getFileKey(file);
    const status = fileStatuses.get(key) || { text: 'Listo', state: 'idle' };
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML =
      '<div class="file-icon"><i class="fa-solid fa-file-pdf"></i></div>' +
      '<div class="file-meta">' +
        '<span class="file-name">' + escapeHtml(file.name) + '</span>' +
        '<span class="file-size">' + formatBytes(file.size) + '</span>' +
      '</div>' +
      '<div class="file-status status-' + status.state + '">' + escapeHtml(status.text) + '</div>' +
      '<button type="button" class="file-remove" data-remove-key="' + escapeHtml(key) + '" aria-label="Quitar archivo">' +
        '<i class="fa-solid fa-xmark"></i>' +
      '</button>';
    fileList.appendChild(item);
  });

  updateCompressButton();
}

function updateCompressButton() {
  compressBtn.disabled = !selectedFiles.length || isBusy;
}

function setMode(mode) {
  activeMode = MODE_PRESETS[mode] ? mode : 'balanced';
  document.querySelectorAll('.mode-card').forEach(function (button) {
    button.classList.toggle('active', button.getAttribute('data-mode') === activeMode);
  });
  modeHintTitle.textContent = MODE_PRESETS[activeMode].hintTitle;
  modeHintText.textContent = MODE_PRESETS[activeMode].hintText;
  resultNote.textContent = MODE_PRESETS[activeMode].note;
}

async function compressSelectedFiles() {
  isBusy = true;
  updateCompressButton();
  resetResult();
  setBusyState(true);
  updateProgress(0, 'Preparando archivos...');

  try {
    const results = [];
    const totalFiles = selectedFiles.length;
    let originalTotal = 0;

    for (let index = 0; index < totalFiles; index += 1) {
      const file = selectedFiles[index];
      const key = getFileKey(file);
      const originalBytes = new Uint8Array(await file.arrayBuffer());
      originalTotal += file.size;

      setFileStatus(key, 'Procesando...', 'working');

      const result = await compressSingleFile(file, originalBytes, function (fraction, label) {
        const overall = ((index + fraction) / totalFiles) * 100;
        updateProgress(overall, label);
      });

      results.push(result);

      if (result.finalSize < result.originalSize) {
        setFileStatus(key, formatBytes(result.originalSize) + ' -> ' + formatBytes(result.finalSize), 'success');
      } else {
        setFileStatus(key, 'Sin mejora notable', 'warning');
      }
    }

    updateProgress(96, selectedFiles.length === 1 ? 'Preparando descarga...' : 'Empaquetando ZIP...');
    const packageResult = await buildDownloadPackage(results);
    updateProgress(100, 'Listo para descargar');
    showResult(results, originalTotal, packageResult);
  } catch (error) {
    console.error(error);
    showModal('No se pudo comprimir', getFriendlyError(error));
  } finally {
    setBusyState(false);
    isBusy = false;
    updateCompressButton();
  }
}

async function compressSingleFile(file, originalBytes, updateStep) {
  if (activeMode === 'safe') {
    updateStep(0.08, 'Optimizando "' + trimLabel(file.name) + '"...');
    const safeBytes = await runSafeOptimization(originalBytes);
    const finalBytes = safeBytes.length < originalBytes.length ? safeBytes : originalBytes;
    return {
      inputName: file.name,
      outputName: buildOutputName(file.name, 'comprimido'),
      bytes: finalBytes,
      originalSize: originalBytes.length,
      finalSize: finalBytes.length,
      method: finalBytes === originalBytes ? 'original' : 'safe'
    };
  }

  const preset = activeMode === 'strong'
    ? { dpi: 120, quality: 0.62, maxPixels: 7000000, imageCompression: 'FAST' }
    : { dpi: 160, quality: 0.82, maxPixels: 10000000, imageCompression: 'MEDIUM' };

  const rasterBytes = await runRasterCompression(originalBytes, preset, function (fraction, label) {
    updateStep(fraction * 0.9, label);
  });

  let chosen = { bytes: rasterBytes, method: 'raster' };

  if (rasterBytes.length >= originalBytes.length * 0.98) {
    updateStep(0.94, 'Probando optimizacion segura...');
    try {
      const safeBytes = await runSafeOptimization(originalBytes);
      const candidates = [
        { bytes: originalBytes, method: 'original' },
        { bytes: rasterBytes, method: 'raster' },
        { bytes: safeBytes, method: 'safe-fallback' }
      ];
      candidates.sort(function (a, b) {
        return a.bytes.length - b.bytes.length;
      });
      chosen = candidates[0];
    } catch (error) {
      chosen = rasterBytes.length < originalBytes.length
        ? { bytes: rasterBytes, method: 'raster' }
        : { bytes: originalBytes, method: 'original' };
    }
  }

  updateStep(1, 'Finalizando "' + trimLabel(file.name) + '"...');

  return {
    inputName: file.name,
    outputName: buildOutputName(file.name, 'comprimido'),
    bytes: chosen.bytes,
    originalSize: originalBytes.length,
    finalSize: chosen.bytes.length,
    method: chosen.method
  };
}

async function runSafeOptimization(originalBytes) {
  const doc = await PDFDocument.load(originalBytes.slice(0));
  const saved = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false
  });
  return new Uint8Array(saved);
}

async function runRasterCompression(originalBytes, preset, onProgress) {
  const loadingTask = pdfjsLib.getDocument({ data: originalBytes.slice(0) });
  const pdf = await loadingTask.promise;
  let outputDoc = null;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = clampScale(baseViewport, preset.dpi / 72, preset.maxPixels);
      const renderViewport = page.getViewport({ scale: scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });

      canvas.width = Math.max(1, Math.floor(renderViewport.width));
      canvas.height = Math.max(1, Math.floor(renderViewport.height));

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      onProgress((pageNumber - 1) / pdf.numPages, 'Renderizando pagina ' + pageNumber + ' de ' + pdf.numPages + '...');

      await page.render({
        canvasContext: context,
        viewport: renderViewport,
        background: '#ffffff'
      }).promise;

      const imageData = canvas.toDataURL('image/jpeg', preset.quality);
      const pageWidth = baseViewport.width;
      const pageHeight = baseViewport.height;
      const orientation = pageWidth > pageHeight ? 'landscape' : 'portrait';

      if (!outputDoc) {
        outputDoc = new jsPDF({
          orientation: orientation,
          unit: 'pt',
          format: [pageWidth, pageHeight],
          compress: true,
          putOnlyUsedFonts: true
        });
      } else {
        outputDoc.addPage([pageWidth, pageHeight], orientation);
      }

      outputDoc.addImage(imageData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, preset.imageCompression);
      onProgress(pageNumber / pdf.numPages, 'Compactando pagina ' + pageNumber + ' de ' + pdf.numPages + '...');

      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
      await waitFrame();
    }

    return new Uint8Array(outputDoc.output('arraybuffer'));
  } finally {
    if (pdf && typeof pdf.cleanup === 'function') {
      pdf.cleanup();
    }
    if (loadingTask && typeof loadingTask.destroy === 'function') {
      loadingTask.destroy();
    }
  }
}

async function buildDownloadPackage(results) {
  if (results.length === 1) {
    const blob = new Blob([results[0].bytes], { type: 'application/pdf' });
    return {
      blob: blob,
      filename: results[0].outputName,
      size: blob.size,
      label: '1 PDF'
    };
  }

  const zip = new JSZip();
  const usedNames = new Set();

  results.forEach(function (result, index) {
    const uniqueName = ensureUniqueName(result.outputName, usedNames, index + 1);
    zip.file(uniqueName, result.bytes);
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    blob: blob,
    filename: 'PulpiTools_PDFs_comprimidos.zip',
    size: blob.size,
    label: results.length + ' PDFs'
  };
}

function showResult(results, originalTotal, packageResult) {
  cleanupDownloadUrl();
  downloadUrl = URL.createObjectURL(packageResult.blob);
  downloadLink.href = downloadUrl;
  downloadLink.download = packageResult.filename;

  const savingsBytes = Math.max(0, originalTotal - packageResult.size);
  const savingsPercent = originalTotal ? ((savingsBytes / originalTotal) * 100) : 0;
  const anyVisualCompression = results.some(function (result) {
    return result.method === 'raster';
  });
  const anyNoGain = results.some(function (result) {
    return result.finalSize >= result.originalSize;
  });

  resultTitle.textContent = savingsBytes > 0 ? 'Compresion completada' : 'Proceso terminado';
  resultMessage.textContent = buildResultMessage(results, originalTotal, packageResult.size, anyNoGain);
  resultNote.textContent = anyVisualCompression
    ? 'Se priorizo mantener la apariencia visual. En algunos archivos el texto seleccionable puede convertirse en imagen.'
    : 'Se conservo la estructura original siempre que fue posible. Si el ahorro fue bajo, es probable que el PDF ya estuviera optimizado.';

  statOriginal.textContent = formatBytes(originalTotal);
  statFinal.textContent = formatBytes(packageResult.size);
  statSavings.textContent = savingsBytes > 0 ? savingsPercent.toFixed(1) + '%' : '0%';
  statOutput.textContent = packageResult.label;

  downloadLink.innerHTML = packageResult.filename.endsWith('.zip')
    ? '<i class="fa-solid fa-file-zipper"></i> Descargar ZIP comprimido'
    : '<i class="fa-solid fa-download"></i> Descargar PDF comprimido';

  resultPanel.style.display = 'block';
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildResultMessage(results, originalTotal, finalSize, anyNoGain) {
  if (results.length === 1) {
    const item = results[0];
    if (item.finalSize < item.originalSize) {
      return 'Tu PDF bajo de ' + formatBytes(item.originalSize) + ' a ' + formatBytes(item.finalSize) + '.';
    }
    return 'Tu archivo ya estaba bastante optimizado y casi no se pudo reducir mas.';
  }

  let message = 'Se procesaron ' + results.length + ' PDFs. El paquete final pesa ' + formatBytes(finalSize) + ' frente a ' + formatBytes(originalTotal) + ' originales.';
  if (anyNoGain) {
    message += ' Algunos archivos ya estaban optimizados y apenas cambiaron.';
  }
  return message;
}

function setBusyState(busy) {
  if (busy) {
    compressBtnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Comprimiendo...';
    loadingSpinner.style.display = 'inline-block';
    progressWrap.style.display = 'block';
  } else {
    compressBtnText.innerHTML = '<i class="fa-solid fa-compress"></i> Comprimir PDFs';
    loadingSpinner.style.display = 'none';
    setTimeout(function () {
      progressWrap.style.display = 'none';
    }, 500);
  }
}

function updateProgress(percent, label) {
  const safePercent = Math.max(0, Math.min(100, percent));
  progressFill.style.width = safePercent.toFixed(1) + '%';
  progressPercent.textContent = Math.round(safePercent) + '%';
  progressLabel.textContent = label;
}

function resetResult() {
  cleanupDownloadUrl();
  resultPanel.style.display = 'none';
  progressFill.style.width = '0%';
  progressPercent.textContent = '0%';
  progressLabel.textContent = 'Preparando...';
}

function setFileStatus(key, text, state) {
  fileStatuses.set(key, { text: text, state: state });
  renderFiles();
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

function cleanupDownloadUrl() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
}

function getFriendlyError(error) {
  if (error && error.name === 'PasswordException') {
    return 'Uno de los PDFs tiene contrasena y no puede abrirse para comprimirlo.';
  }
  if (error && /password/i.test(String(error.message || ''))) {
    return 'Uno de los PDFs esta protegido con contrasena.';
  }
  if (error && /Invalid PDF/i.test(String(error.message || ''))) {
    return 'El archivo no parece ser un PDF valido o esta dañado.';
  }
  return 'Ocurrio un error durante la compresion. Prueba con otro PDF o cambia al modo Seguro.';
}

function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function getFileKey(file) {
  return [file.name, file.size, file.lastModified].join('__');
}

function buildOutputName(originalName, suffix) {
  const cleanBase = originalName.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'archivo';
  return cleanBase + '_PulpiTools_' + suffix + '.pdf';
}

function ensureUniqueName(name, usedNames, index) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const base = name.replace(/\.pdf$/i, '');
  let counter = index;
  let candidate = base + '_' + counter + '.pdf';

  while (usedNames.has(candidate)) {
    counter += 1;
    candidate = base + '_' + counter + '.pdf';
  }

  usedNames.add(candidate);
  return candidate;
}

function clampScale(viewport, scale, maxPixels) {
  const estimatedPixels = viewport.width * scale * viewport.height * scale;
  if (estimatedPixels <= maxPixels) return scale;
  return scale * Math.sqrt(maxPixels / estimatedPixels);
}

function waitFrame() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return (index === 0 ? value.toFixed(0) : value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)) + ' ' + units[index];
}

function trimLabel(name) {
  return name.length > 28 ? name.slice(0, 25) + '...' : name;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
