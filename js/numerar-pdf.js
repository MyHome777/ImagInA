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

const { PDFDocument, StandardFonts, rgb } = PDFLib;

const pdfInput = document.getElementById('pdfInput');
const dropZone = document.getElementById('dropZone');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const fileSummaryEmpty = document.getElementById('fileSummaryEmpty');
const fileSummaryReady = document.getElementById('fileSummaryReady');
const summaryStatus = document.getElementById('summaryStatus');
const fileName = document.getElementById('fileName');
const filePages = document.getElementById('filePages');
const fileSize = document.getElementById('fileSize');
const fileOutput = document.getElementById('fileOutput');
const rangeTabs = document.querySelectorAll('[data-range-mode]');
const customRangeWrap = document.getElementById('customRangeWrap');
const rangeInput = document.getElementById('rangeInput');
const rangeHelp = document.getElementById('rangeHelp');
const positionCards = document.querySelectorAll('[data-position]');
const formatCards = document.querySelectorAll('[data-format]');
const startNumber = document.getElementById('startNumber');
const fontFamily = document.getElementById('fontFamily');
const fontWeight = document.getElementById('fontWeight');
const textColor = document.getElementById('textColor');
const fontSizeRange = document.getElementById('fontSizeRange');
const marginRange = document.getElementById('marginRange');
const opacityRange = document.getElementById('opacityRange');
const fontSizeValue = document.getElementById('fontSizeValue');
const marginValue = document.getElementById('marginValue');
const opacityValue = document.getElementById('opacityValue');
const previewNumber = document.getElementById('previewNumber');
const previewPage = document.getElementById('previewPage');
const previewCanvas = document.getElementById('previewCanvas');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const previewModeBadge = document.getElementById('previewModeBadge');
const previewTarget = document.getElementById('previewTarget');
const previewPages = document.getElementById('previewPages');
const previewPosition = document.getElementById('previewPosition');
const previewOutputName = document.getElementById('previewOutputName');
const processBtn = document.getElementById('processBtn');
const processBtnText = document.getElementById('processBtnText');
const loadingSpinner = document.getElementById('loadingSpinner');
const progressWrap = document.getElementById('progressWrap');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const resultPanel = document.getElementById('resultPanel');
const resultMessage = document.getElementById('resultMessage');
const downloadLink = document.getElementById('downloadLink');
const modal = document.getElementById('customModal');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCloseBtn = document.getElementById('modalCloseBtn');

const state = {
  file: null,
  fileBytes: null,
  pageCount: 0,
  rangeMode: 'all',
  position: 'bottom-center',
  format: 'page-of-total',
  outputUrl: null,
  busy: false,
  previewToken: 0
};

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
  if (!state.busy) dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragover', function () {
  if (!state.busy) dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', function () {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', function (event) {
  dropZone.classList.remove('dragover');
  if (state.busy) return;
  if (event.dataTransfer.files.length) {
    loadFile(event.dataTransfer.files[0]);
  }
});

pdfInput.addEventListener('change', function () {
  if (this.files.length) {
    loadFile(this.files[0]);
  }
  this.value = '';
});

rangeTabs.forEach(function (button) {
  button.addEventListener('click', function () {
    if (state.busy) return;
    state.rangeMode = this.getAttribute('data-range-mode');
    updateRangeModeUI();
    validateRange();
    updatePreview();
  });
});

positionCards.forEach(function (button) {
  button.addEventListener('click', function () {
    if (state.busy) return;
    state.position = this.getAttribute('data-position');
    updatePositionUI();
    updatePreview();
  });
});

formatCards.forEach(function (button) {
  button.addEventListener('click', function () {
    if (state.busy) return;
    state.format = this.getAttribute('data-format');
    updateFormatUI();
    updatePreview();
  });
});

[rangeInput, startNumber, fontFamily, fontWeight, textColor, fontSizeRange, marginRange, opacityRange].forEach(function (control) {
  control.addEventListener('input', function () {
    validateRange();
    updatePreview();
  });
});

processBtn.addEventListener('click', function () {
  if (state.busy || !canProcess()) return;
  processPdf();
});

modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', function (event) {
  if (event.target === modal) closeModal();
});

updateRangeModeUI();
updatePositionUI();
updateFormatUI();
updatePreview();

async function loadFile(file) {
  if (!isPdfFile(file)) {
    showModal('Archivo no valido', 'Selecciona un documento PDF para continuar.');
    return;
  }

  resetResult();
  summaryStatus.textContent = 'Leyendo PDF...';

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(bytes.slice(0));

    state.file = file;
    state.fileBytes = bytes;
    state.pageCount = pdfDoc.getPageCount();

    fileSummaryEmpty.style.display = 'none';
    fileSummaryReady.style.display = 'grid';
    summaryStatus.textContent = 'PDF listo';
    fileName.textContent = file.name;
    filePages.textContent = state.pageCount + ' pagina' + (state.pageCount === 1 ? '' : 's');
    fileSize.textContent = formatBytes(file.size);
    fileOutput.textContent = 'Salida: ' + buildOutputName(file.name);

    await renderPreviewPage(bytes);
    validateRange();
    updatePreview();
  } catch (error) {
    console.error(error);
    clearLoadedFile();
    showModal('No se pudo abrir el PDF', 'El archivo parece estar dañado, vacio o protegido con contrasena.');
  }
}

function clearLoadedFile() {
  state.file = null;
  state.fileBytes = null;
  state.pageCount = 0;
  state.previewToken += 1;
  fileSummaryEmpty.style.display = 'block';
  fileSummaryReady.style.display = 'none';
  summaryStatus.textContent = 'Esperando PDF';
  resetPreviewCanvas();
  validateRange();
  updatePreview();
}

function updateRangeModeUI() {
  rangeTabs.forEach(function (button) {
    button.classList.toggle('active', button.getAttribute('data-range-mode') === state.rangeMode);
  });
  customRangeWrap.style.display = state.rangeMode === 'custom' ? 'block' : 'none';
  rangeInput.disabled = state.rangeMode !== 'custom';
}

function updatePositionUI() {
  positionCards.forEach(function (button) {
    button.classList.toggle('active', button.getAttribute('data-position') === state.position);
  });
}

function updateFormatUI() {
  formatCards.forEach(function (button) {
    button.classList.toggle('active', button.getAttribute('data-format') === state.format);
  });
}

function updatePreview() {
  const effectiveCount = getPreviewRangeCount();
  const previewText = buildLabel(Number(startNumber.value || 1), Math.max(effectiveCount, 1));
  const previewOffset = Math.max(14, Math.min(36, Math.round(Number(marginRange.value) * 0.7)));
  const previewFont = Math.max(11, Math.min(22, Math.round(Number(fontSizeRange.value) * 0.78)));

  fontSizeValue.textContent = fontSizeRange.value + ' pt';
  marginValue.textContent = marginRange.value + ' pt';
  opacityValue.textContent = opacityRange.value + '%';

  previewNumber.textContent = previewText;
  previewNumber.className = 'preview-number ' + state.position;
  previewNumber.style.fontSize = previewFont + 'px';
  previewNumber.style.opacity = String(Number(opacityRange.value) / 100);
  previewNumber.style.color = textColor.value;
  previewNumber.style.fontWeight = fontWeight.value === 'bold' ? '700' : '500';
  previewNumber.style.fontFamily = getPreviewFontFamily(fontFamily.value);
  previewNumber.style.setProperty('--preview-offset', previewOffset + 'px');

  previewModeBadge.textContent = getFormatLabel(state.format);
  previewTarget.textContent = effectiveCount + ' pagina' + (effectiveCount === 1 ? '' : 's');
  previewPages.textContent = state.pageCount ? state.pageCount + ' paginas' : 'Sin archivo';
  previewPosition.textContent = getPositionLabel(state.position);
  previewOutputName.textContent = state.file ? buildOutputName(state.file.name) : 'documento_numerado.pdf';

  processBtn.disabled = !canProcess();
}

function validateRange() {
  if (state.rangeMode !== 'custom') {
    rangeInput.classList.remove('invalid');
    rangeHelp.classList.remove('error');
    rangeHelp.textContent = 'Se numeraran todas las paginas del documento.';
    return true;
  }

  if (!state.pageCount) {
    rangeInput.classList.remove('invalid');
    rangeHelp.classList.remove('error');
    rangeHelp.textContent = 'Carga un PDF para validar el rango.';
    return false;
  }

  try {
    const indices = parseRangeInput(rangeInput.value, state.pageCount);
    rangeInput.classList.remove('invalid');
    rangeHelp.classList.remove('error');
    rangeHelp.textContent = 'Se numeraran ' + indices.length + ' pagina' + (indices.length === 1 ? '' : 's') + '.';
    return true;
  } catch (error) {
    rangeInput.classList.add('invalid');
    rangeHelp.classList.add('error');
    rangeHelp.textContent = error.message;
    return false;
  }
}

function canProcess() {
  if (!state.file || !state.fileBytes || !state.pageCount || state.busy) return false;
  if (Number(startNumber.value) < 1) return false;
  return state.rangeMode === 'all' ? true : validateRange();
}

async function processPdf() {
  state.busy = true;
  updatePreview();
  setBusyState(true);
  resetResult();

  try {
    const sourcePdf = await PDFDocument.load(state.fileBytes.slice(0));
    const pageIndices = state.rangeMode === 'all'
      ? Array.from({ length: state.pageCount }, function (_, index) { return index; })
      : parseRangeInput(rangeInput.value, state.pageCount);

    const font = await sourcePdf.embedFont(resolveFontKey(fontFamily.value, fontWeight.value));
    const startAt = Math.max(1, Number(startNumber.value) || 1);
    const totalToNumber = pageIndices.length;
    const color = hexToRgb(textColor.value);
    const size = Number(fontSizeRange.value);
    const margin = Number(marginRange.value);
    const opacity = Number(opacityRange.value) / 100;

    for (let i = 0; i < pageIndices.length; i += 1) {
      const pageIndex = pageIndices[i];
      const page = sourcePdf.getPage(pageIndex);
      const label = buildLabel(startAt + i, totalToNumber);
      const placement = measurePlacement(page, font, label, size, margin, state.position);

      page.drawText(label, {
        x: placement.x,
        y: placement.y,
        size: size,
        font: font,
        color: rgb(color.r, color.g, color.b),
        opacity: opacity
      });

      updateProgress(((i + 1) / pageIndices.length) * 100, 'Numerando pagina ' + (pageIndex + 1) + ' de ' + state.pageCount + '...');
      await waitFrame();
    }

    updateProgress(100, 'Generando PDF final...');
    const outputBytes = await sourcePdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false
    });
    const outputName = buildOutputName(state.file.name);
    const outputBlob = new Blob([outputBytes], { type: 'application/pdf' });

    cleanupDownloadUrl();
    state.outputUrl = URL.createObjectURL(outputBlob);
    downloadLink.href = state.outputUrl;
    downloadLink.download = outputName;
    resultMessage.textContent = 'Se numeraron ' + totalToNumber + ' pagina' + (totalToNumber === 1 ? '' : 's') + ' en "' + state.file.name + '" con formato ' + getFormatLabel(state.format).toLowerCase() + '.';
    resultPanel.style.display = 'block';
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error(error);
    showModal('No se pudo numerar el PDF', getFriendlyError(error));
  } finally {
    setBusyState(false);
    state.busy = false;
    updatePreview();
  }
}

async function renderPreviewPage(bytes) {
  const token = ++state.previewToken;
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });

  try {
    previewPlaceholder.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i>' +
      '<div><strong>Generando vista previa</strong><span>Renderizando la primera pagina del PDF...</span></div>';
    previewPlaceholder.style.display = 'flex';
    previewCanvas.style.display = 'none';

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    if (token !== state.previewToken) {
      if (typeof loadingTask.destroy === 'function') loadingTask.destroy();
      return;
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const maxWidth = 300;
    const maxHeight = 430;
    const cssScale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
    const outputScale = Math.max(1, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: cssScale * outputScale });
    const context = previewCanvas.getContext('2d', { alpha: false });

    previewCanvas.width = Math.max(1, Math.floor(viewport.width));
    previewCanvas.height = Math.max(1, Math.floor(viewport.height));
    previewCanvas.style.width = Math.max(1, Math.floor(baseViewport.width * cssScale)) + 'px';
    previewCanvas.style.height = Math.max(1, Math.floor(baseViewport.height * cssScale)) + 'px';
    previewPage.style.width = previewCanvas.style.width;
    previewPage.style.minHeight = previewCanvas.style.height;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport,
      background: '#ffffff'
    }).promise;

    if (token !== state.previewToken) return;

    previewCanvas.style.display = 'block';
    previewPlaceholder.style.display = 'none';
    page.cleanup();
    if (typeof pdf.cleanup === 'function') pdf.cleanup();
  } catch (error) {
    console.error(error);
    if (token !== state.previewToken) return;
    previewCanvas.style.display = 'none';
    previewPage.style.width = '';
    previewPage.style.minHeight = '';
    previewPlaceholder.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i>' +
      '<div><strong>No se pudo generar la vista previa</strong><span>El PDF se puede seguir numerando, pero la previsualizacion no estuvo disponible.</span></div>';
    previewPlaceholder.style.display = 'flex';
  } finally {
    if (typeof loadingTask.destroy === 'function') {
      loadingTask.destroy();
    }
  }
}

function resetPreviewCanvas() {
  previewCanvas.width = 0;
  previewCanvas.height = 0;
  previewCanvas.style.display = 'none';
  previewCanvas.style.width = '';
  previewCanvas.style.height = '';
  previewPage.style.width = '';
  previewPage.style.minHeight = '';
  previewPlaceholder.innerHTML =
    '<i class="fa-solid fa-file-lines"></i>' +
    '<div><strong>Vista previa del PDF</strong><span>Carga un documento para mostrar la primera pagina real y previsualizar la numeracion.</span></div>';
  previewPlaceholder.style.display = 'flex';
}

function measurePlacement(page, font, text, size, margin, position) {
  const pageSize = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, size);
  const textHeight = font.heightAtSize(size);
  const safeX = Math.max(8, margin);
  const safeY = Math.max(8, margin);
  let x = safeX;
  let y = safeY;

  if (position.indexOf('center') !== -1) {
    x = (pageSize.width - textWidth) / 2;
  } else if (position.indexOf('right') !== -1) {
    x = pageSize.width - textWidth - safeX;
  }

  if (position.indexOf('top') === 0) {
    y = pageSize.height - textHeight - safeY;
  } else {
    y = safeY;
  }

  return { x: Math.max(0, x), y: Math.max(0, y) };
}

function getPreviewRangeCount() {
  if (!state.pageCount) return 1;
  if (state.rangeMode === 'all') return state.pageCount;
  try {
    return parseRangeInput(rangeInput.value, state.pageCount).length;
  } catch (error) {
    return 1;
  }
}

function parseRangeInput(rawValue, maxPage) {
  const cleaned = String(rawValue || '').replace(/\s+/g, '');
  if (!cleaned) {
    throw new Error('Escribe un rango valido. Ejemplo: 2-5, 8, 10-12');
  }

  const parts = cleaned.split(',');
  const pages = new Set();

  parts.forEach(function (part) {
    if (!part) {
      throw new Error('Hay una coma vacia en el rango. Revisa el formato.');
    }

    if (/^\d+$/.test(part)) {
      const page = Number(part);
      assertPage(page, maxPage);
      pages.add(page);
      return;
    }

    const openRange = part.match(/^(\d+)-$/);
    if (openRange) {
      const start = Number(openRange[1]);
      assertPage(start, maxPage);
      for (let page = start; page <= maxPage; page += 1) {
        pages.add(page);
      }
      return;
    }

    const fullRange = part.match(/^(\d+)-(\d+)$/);
    if (fullRange) {
      const start = Number(fullRange[1]);
      const end = Number(fullRange[2]);
      if (start > end) {
        throw new Error('Los rangos deben ir de menor a mayor, por ejemplo 3-8.');
      }
      assertPage(start, maxPage);
      assertPage(end, maxPage);
      for (let page = start; page <= end; page += 1) {
        pages.add(page);
      }
      return;
    }

    throw new Error('Formato de rango no valido. Usa algo como 1-3, 5, 8-10.');
  });

  if (!pages.size) {
    throw new Error('No se encontraron paginas validas para numerar.');
  }

  return Array.from(pages).sort(function (a, b) { return a - b; }).map(function (page) {
    return page - 1;
  });
}

function assertPage(page, maxPage) {
  if (page < 1 || page > maxPage) {
    throw new Error('El rango contiene paginas fuera del PDF. Total disponible: ' + maxPage + '.');
  }
}

function buildLabel(currentNumber, totalNumbered) {
  switch (state.format) {
    case 'number':
      return String(currentNumber);
    case 'page-number':
      return 'Pagina ' + currentNumber;
    case 'number-total':
      return currentNumber + ' / ' + totalNumbered;
    case 'page-of-total':
    default:
      return 'Pagina ' + currentNumber + ' de ' + totalNumbered;
  }
}

function getFormatLabel(format) {
  switch (format) {
    case 'number': return 'Solo numero';
    case 'page-number': return 'Pagina X';
    case 'number-total': return 'X / Total';
    case 'page-of-total':
    default: return 'Pagina X de Y';
  }
}

function getPositionLabel(position) {
  const labels = {
    'top-left': 'Arriba izquierda',
    'top-center': 'Arriba centro',
    'top-right': 'Arriba derecha',
    'bottom-left': 'Abajo izquierda',
    'bottom-center': 'Abajo centro',
    'bottom-right': 'Abajo derecha'
  };
  return labels[position] || 'Abajo centro';
}

function getPreviewFontFamily(fontKey) {
  switch (fontKey) {
    case 'times': return '"Times New Roman", Times, serif';
    case 'courier': return '"Courier New", Courier, monospace';
    case 'helvetica':
    default: return 'Arial, Helvetica, sans-serif';
  }
}

function resolveFontKey(family, weight) {
  const bold = weight === 'bold';
  if (family === 'times') {
    return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
  }
  if (family === 'courier') {
    return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  }
  return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
}

function setBusyState(busy) {
  processBtn.disabled = busy;
  if (busy) {
    processBtnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando numeracion...';
    loadingSpinner.style.display = 'inline-block';
    progressWrap.style.display = 'block';
  } else {
    processBtnText.innerHTML = '<i class="fa-solid fa-list-ol"></i> Aplicar numeracion';
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
  progressLabel.textContent = 'Preparando PDF...';
}

function cleanupDownloadUrl() {
  if (state.outputUrl) {
    URL.revokeObjectURL(state.outputUrl);
    state.outputUrl = null;
  }
}

function buildOutputName(originalName) {
  const cleanBase = originalName.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'documento';
  return cleanBase + '_PulpiTools_numerado.pdf';
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

function getFriendlyError(error) {
  if (error && /password/i.test(String(error.message || ''))) {
    return 'El PDF parece tener contrasena y no se puede modificar desde aqui.';
  }
  if (error && /Invalid PDF/i.test(String(error.message || ''))) {
    return 'El archivo no parece ser un PDF valido o esta dañado.';
  }
  return 'Ocurrio un error al aplicar la numeracion. Revisa el rango y vuelve a intentarlo.';
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map(function (char) { return char + char; }).join('')
    : value;

  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255
  };
}

function isPdfFile(file) {
  return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return (index === 0 ? value.toFixed(0) : value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)) + ' ' + units[index];
}

function waitFrame() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}
