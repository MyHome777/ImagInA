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

const { PDFDocument, degrees } = PDFLib;

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
const rotateCards = document.querySelectorAll('[data-rotate]');
const rotationHelper = document.getElementById('rotationHelper');
const previewBadge = document.getElementById('previewBadge');
const previewCanvasShell = document.getElementById('previewCanvasShell');
const previewCanvas = document.getElementById('previewCanvas');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const previewTarget = document.getElementById('previewTarget');
const previewPages = document.getElementById('previewPages');
const previewRotation = document.getElementById('previewRotation');
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
  rotation: 90,
  busy: false,
  outputUrl: null,
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

rotateCards.forEach(function (button) {
  button.addEventListener('click', function () {
    if (state.busy) return;
    state.rotation = Number(this.getAttribute('data-rotate'));
    updateRotationUI();
    updatePreview();
  });
});

rangeInput.addEventListener('input', function () {
  validateRange();
  updatePreview();
});

processBtn.addEventListener('click', function () {
  if (state.busy || !canProcess()) return;
  rotatePdf();
});

modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', function (event) {
  if (event.target === modal) closeModal();
});

updateRangeModeUI();
updateRotationUI();
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

function updateRotationUI() {
  rotateCards.forEach(function (button) {
    button.classList.toggle('active', Number(button.getAttribute('data-rotate')) === state.rotation);
  });
  previewBadge.textContent = getRotationLabel(state.rotation);
  rotationHelper.textContent = state.rotation === 180
    ? 'El giro de 180° voltea completamente las paginas. Es util cuando el PDF se guardo al reves.'
    : 'El giro se aplica sobre la orientacion actual del PDF. Si una pagina ya viene girada, se ajusta a partir de ese angulo y se guarda lista para descargar.';
}

function updatePreview() {
  const targetCount = getPreviewRangeCount();
  previewTarget.textContent = targetCount + ' pagina' + (targetCount === 1 ? '' : 's');
  previewPages.textContent = state.pageCount ? state.pageCount + ' paginas' : 'Sin archivo';
  previewRotation.textContent = getRotationLabel(state.rotation);
  previewOutputName.textContent = state.file ? buildOutputName(state.file.name) : 'documento_rotado.pdf';
  previewCanvasShell.style.transform = 'rotate(' + state.rotation + 'deg)';
  processBtn.disabled = !canProcess();
}

function validateRange() {
  if (state.rangeMode !== 'custom') {
    rangeInput.classList.remove('invalid');
    rangeHelp.classList.remove('error');
    rangeHelp.textContent = 'Se rotaran todas las paginas del documento.';
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
    rangeHelp.textContent = 'Se rotaran ' + indices.length + ' pagina' + (indices.length === 1 ? '' : 's') + '.';
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
  return state.rangeMode === 'all' ? true : validateRange();
}

async function rotatePdf() {
  state.busy = true;
  updatePreview();
  setBusyState(true);
  resetResult();

  try {
    const sourcePdf = await PDFDocument.load(state.fileBytes.slice(0));
    const pageIndices = state.rangeMode === 'all'
      ? Array.from({ length: state.pageCount }, function (_, index) { return index; })
      : parseRangeInput(rangeInput.value, state.pageCount);

    for (let i = 0; i < pageIndices.length; i += 1) {
      const pageIndex = pageIndices[i];
      const page = sourcePdf.getPage(pageIndex);
      const currentAngle = page.getRotation().angle || 0;
      const nextAngle = normalizeAngle(currentAngle + state.rotation);
      page.setRotation(degrees(nextAngle));

      updateProgress(((i + 1) / pageIndices.length) * 100, 'Rotando pagina ' + (pageIndex + 1) + ' de ' + state.pageCount + '...');
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
    resultMessage.textContent = 'Se aplico un giro de ' + getRotationLabel(state.rotation).toLowerCase() + ' a ' + pageIndices.length + ' pagina' + (pageIndices.length === 1 ? '' : 's') + '.';
    resultPanel.style.display = 'block';
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error(error);
    showModal('No se pudo rotar el PDF', getFriendlyError(error));
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

    if (token !== state.previewToken) return;

    const baseViewport = page.getViewport({ scale: 1 });
    const maxWidth = 300;
    const maxHeight = 420;
    const cssScale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
    const outputScale = Math.max(1, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: cssScale * outputScale });
    const context = previewCanvas.getContext('2d', { alpha: false });

    previewCanvas.width = Math.max(1, Math.floor(viewport.width));
    previewCanvas.height = Math.max(1, Math.floor(viewport.height));
    previewCanvas.style.width = Math.max(1, Math.floor(baseViewport.width * cssScale)) + 'px';
    previewCanvas.style.height = Math.max(1, Math.floor(baseViewport.height * cssScale)) + 'px';

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
    previewPlaceholder.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i>' +
      '<div><strong>No se pudo generar la vista previa</strong><span>El PDF se puede seguir rotando, pero la previsualizacion no estuvo disponible.</span></div>';
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
  previewCanvasShell.style.transform = 'rotate(' + state.rotation + 'deg)';
  previewPlaceholder.innerHTML =
    '<i class="fa-solid fa-file-lines"></i>' +
    '<div><strong>Vista previa del PDF</strong><span>Carga un documento para ver la primera pagina real y su rotacion antes de guardar.</span></div>';
  previewPlaceholder.style.display = 'flex';
}

function setBusyState(busy) {
  processBtn.disabled = busy;
  if (busy) {
    processBtnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rotando PDF...';
    loadingSpinner.style.display = 'inline-block';
    progressWrap.style.display = 'block';
  } else {
    processBtnText.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Rotar PDF';
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

function getPreviewRangeCount() {
  if (!state.pageCount) return 0;
  if (state.rangeMode === 'all') return state.pageCount;
  try {
    return parseRangeInput(rangeInput.value, state.pageCount).length;
  } catch (error) {
    return 0;
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
    throw new Error('No se encontraron paginas validas para rotar.');
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

function getRotationLabel(rotation) {
  if (rotation === -90) return '90° izquierda';
  if (rotation === 180) return '180°';
  return '90° derecha';
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function buildOutputName(originalName) {
  const cleanBase = originalName.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'documento';
  return cleanBase + '_PulpiTools_rotado.pdf';
}

function cleanupDownloadUrl() {
  if (state.outputUrl) {
    URL.revokeObjectURL(state.outputUrl);
    state.outputUrl = null;
  }
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
  return 'Ocurrio un error al rotar el documento. Revisa el rango y vuelve a intentarlo.';
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
