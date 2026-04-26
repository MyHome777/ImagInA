const state = {
  lastNormalizedUrl: '',
  hasQr: false,
  generateToken: 0
};

const elements = {
  linkInput: document.getElementById('linkInput'),
  sizeRange: document.getElementById('sizeRange'),
  sizeValue: document.getElementById('sizeValue'),
  marginRange: document.getElementById('marginRange'),
  marginValue: document.getElementById('marginValue'),
  fgColor: document.getElementById('fgColor'),
  bgColor: document.getElementById('bgColor'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  qrCanvas: document.getElementById('qrCanvas'),
  qrEmpty: document.getElementById('qrEmpty'),
  qrMeta: document.getElementById('qrMeta'),
  normalizedUrl: document.getElementById('normalizedUrl'),
  charCount: document.getElementById('charCount'),
  statusText: document.getElementById('statusText'),
  modal: document.getElementById('customModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalCloseBtn: document.getElementById('modalCloseBtn')
};

init();

function init() {
  bindEvents();
  refreshRangeLabels();
  updateCharCount('');
}

function bindEvents() {
  elements.generateBtn.addEventListener('click', generateQr);
  elements.downloadBtn.addEventListener('click', downloadQrPng);

  elements.linkInput.addEventListener('input', debounceAutoGenerate);
  elements.sizeRange.addEventListener('input', () => {
    refreshRangeLabels();
    debounceAutoGenerate();
  });
  elements.marginRange.addEventListener('input', () => {
    refreshRangeLabels();
    debounceAutoGenerate();
  });

  [elements.fgColor, elements.bgColor].forEach((control) => {
    control.addEventListener('change', debounceAutoGenerate);
  });

  elements.modalCloseBtn.addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (event) => {
    if (event.target === elements.modal) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && document.activeElement === elements.linkInput) {
      event.preventDefault();
      generateQr();
    }
    if (event.key === 'Escape') closeModal();
  });
}

function refreshRangeLabels() {
  elements.sizeValue.textContent = `${Number(elements.sizeRange.value)} px`;
  elements.marginValue.textContent = `${Number(elements.marginRange.value)}`;
}

const debounceAutoGenerate = debounce(() => {
  const raw = elements.linkInput.value;
  updateCharCount(raw);

  if (!raw.trim()) {
    clearQr('Ingresa un enlace para generar tu QR.');
    return;
  }

  generateQr({ silentError: true });
}, 220);

async function generateQr(options = {}) {
  const { silentError = false } = options;
  const rawValue = elements.linkInput.value;
  updateCharCount(rawValue);

  let normalizedUrl;
  try {
    normalizedUrl = normalizeAndValidateUrl(rawValue);
  } catch (error) {
    clearQr('El enlace no es valido.', true);
    if (!silentError) showModal('Enlace invalido', error.message);
    return;
  }

  const size = Number(elements.sizeRange.value);
  const margin = Number(elements.marginRange.value);
  const dark = normalizeHexColor(elements.fgColor.value, '#111111');
  const light = normalizeHexColor(elements.bgColor.value, '#ffffff');

  // Prevent race conditions when user types quickly.
  state.generateToken += 1;
  const token = state.generateToken;

  try {
    setWorkingState(true, 'Generando QR...');

    await renderQrFromApi(elements.qrCanvas, {
      data: normalizedUrl,
      size,
      margin,
      dark,
      light
    });

    if (token !== state.generateToken) return;

    state.lastNormalizedUrl = normalizedUrl;
    state.hasQr = true;

    showQrPreview(normalizedUrl);
    setStatus('QR generado correctamente.', 'ok');
  } catch (error) {
    console.error(error);
    clearQr('No se pudo generar el QR.', true);
    if (!silentError) {
      showModal('Error al generar QR', 'No fue posible generar el codigo QR. Intenta de nuevo con otro enlace o configuracion.');
    }
  } finally {
    setWorkingState(false);
  }
}

function showQrPreview(normalizedUrl) {
  elements.qrCanvas.style.display = 'block';
  elements.qrEmpty.style.display = 'none';
  elements.qrMeta.style.display = 'flex';
  elements.normalizedUrl.textContent = normalizedUrl;
  elements.downloadBtn.disabled = false;
}

function clearQr(message, isError = false) {
  state.hasQr = false;
  state.lastNormalizedUrl = '';

  const ctx = elements.qrCanvas.getContext('2d');
  ctx.clearRect(0, 0, elements.qrCanvas.width, elements.qrCanvas.height);

  elements.qrCanvas.style.display = 'none';
  elements.qrEmpty.style.display = 'flex';
  elements.qrMeta.style.display = 'none';
  elements.normalizedUrl.textContent = '';
  elements.downloadBtn.disabled = true;

  setStatus(message, isError ? 'error' : '');
}

function setWorkingState(isWorking, message = '') {
  elements.generateBtn.disabled = isWorking;
  if (isWorking && message) {
    setStatus(message, '');
  }
}

function setStatus(message, type) {
  elements.statusText.textContent = message;
  elements.statusText.className = 'status';
  if (type) elements.statusText.classList.add(type);
}

function updateCharCount(value) {
  const chars = value.trim().length;
  elements.charCount.textContent = `${chars} caracteres`;
}

async function downloadQrPng() {
  if (!state.hasQr) return;

  const canvas = elements.qrCanvas;

  try {
    const blob = await canvasToBlob(canvas);
    const fileName = buildFileNameFromUrl(state.lastNormalizedUrl);
    triggerBlobDownload(blob, fileName);
    setStatus('Descarga iniciada.', 'ok');
  } catch (error) {
    console.error(error);
    showModal('No se pudo descargar', 'No fue posible exportar el QR en PNG. Intenta generar nuevamente.');
  }
}

function normalizeAndValidateUrl(inputValue) {
  const value = (inputValue || '').trim();
  if (!value) {
    throw new Error('Debes ingresar un enlace para generar el QR.');
  }

  if (/\s/.test(value)) {
    throw new Error('El enlace contiene espacios. Verifica el formato.');
  }

  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
  let candidate = value;

  if (!hasProtocol) {
    candidate = looksLikeDomain(value) ? `https://${value}` : '';
  }

  if (!candidate) {
    throw new Error('Escribe un enlace completo como https://tu-sitio.com');
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (_) {
    throw new Error('No se pudo interpretar el enlace. Revisa dominio y ruta.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Solo se permiten enlaces HTTP o HTTPS.');
  }

  if (!parsed.hostname || parsed.hostname.length < 3) {
    throw new Error('El dominio del enlace no es valido.');
  }

  return parsed.toString();
}

function looksLikeDomain(value) {
  // Basic domain/url path heuristic for user convenience.
  return /^[^/\s]+\.[^/\s]+(\/.*)?$/.test(value);
}

function normalizeHexColor(value, fallback) {
  return /^#[\da-fA-F]{6}$/.test(value) ? value : fallback;
}

async function renderQrFromApi(canvas, options) {
  const { data, size, margin, dark, light } = options;
  const url = buildQrApiUrl({
    data,
    size,
    margin,
    dark,
    light
  });

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('No se pudo obtener la imagen QR.');
  }

  const blob = await response.blob();
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  await drawBlobOnCanvas(ctx, blob, size);
}

function buildQrApiUrl({ data, size, margin, dark, light }) {
  const base = 'https://api.qrserver.com/v1/create-qr-code/';
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data,
    qzone: String(margin),
    color: hexToRgbCsv(dark),
    bgcolor: hexToRgbCsv(light),
    ecc: 'M',
    format: 'png'
  });

  return `${base}?${params.toString()}`;
}

function hexToRgbCsv(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}-${g}-${b}`;
}

async function drawBlobOnCanvas(ctx, blob, size) {
  if (typeof createImageBitmap === 'function') {
    const imageBitmap = await createImageBitmap(blob);
    ctx.drawImage(imageBitmap, 0, 0, size, size);
    return;
  }

  await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen QR.'));
    };

    img.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('No se pudo crear el archivo PNG.'));
      }
    }, 'image/png');
  });
}

function buildFileNameFromUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const host = (parsed.hostname || 'qr').replace(/[^a-z0-9.-]/gi, '').replace(/\.+/g, '.');
    return `qr-${host || 'link'}.png`;
  } catch (_) {
    return 'qr-link.png';
  }
}

function triggerBlobDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function showModal(title, message) {
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modal.classList.add('active');
}

function closeModal() {
  elements.modal.classList.remove('active');
}

function debounce(fn, waitMs) {
  let timeoutId = null;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), waitMs);
  };
}
