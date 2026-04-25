const state = {
  files: [],
  downloadUrl: null,
  qpdf: null,
  qpdfPromise: null
};

const elements = {
  dropZone: document.getElementById('dropZone'),
  pdfInput: document.getElementById('pdfInput'),
  fileList: document.getElementById('fileList'),
  filesCount: document.getElementById('filesCount'),
  emptyState: document.getElementById('emptyState'),
  passwordInput: document.getElementById('passwordInput'),
  confirmPasswordInput: document.getElementById('confirmPasswordInput'),
  passwordStatus: document.getElementById('passwordStatus'),
  protectBtn: document.getElementById('protectBtn'),
  protectBtnText: document.getElementById('protectBtnText'),
  loadingSpinner: document.getElementById('loadingSpinner'),
  progressWrap: document.getElementById('progressWrap'),
  progressLabel: document.getElementById('progressLabel'),
  progressPercent: document.getElementById('progressPercent'),
  progressFill: document.getElementById('progressFill'),
  resultPanel: document.getElementById('resultPanel'),
  resultMessage: document.getElementById('resultMessage'),
  downloadLink: document.getElementById('downloadLink'),
  modal: document.getElementById('customModal'),
  modalIcon: document.getElementById('modalIcon'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalCloseBtn: document.getElementById('modalCloseBtn')
};

init();

function init() {
  bindUploadEvents();
  bindPasswordEvents();
  bindModalEvents();
  bindVisibilityToggles();
  elements.protectBtn.addEventListener('click', protectFiles);
  renderFiles();
  validateForm();
}

function bindUploadEvents() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, () => elements.dropZone.classList.add('dragover'));
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, () => elements.dropZone.classList.remove('dragover'));
  });

  elements.dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
  elements.pdfInput.addEventListener('change', (event) => addFiles(event.target.files));
}

function bindPasswordEvents() {
  [elements.passwordInput, elements.confirmPasswordInput].forEach((input) => {
    input.addEventListener('input', () => {
      hideResult();
      validateForm();
    });
  });
}

function bindModalEvents() {
  elements.modalCloseBtn.addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (event) => {
    if (event.target === elements.modal) closeModal();
  });
}

function bindVisibilityToggles() {
  document.querySelectorAll('.toggle-visibility').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      const icon = button.querySelector('i');
      const shouldShow = input.type === 'password';
      input.type = shouldShow ? 'text' : 'password';
      icon.className = shouldShow ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });
  });
}

function addFiles(fileList) {
  const incomingFiles = Array.from(fileList || []);
  if (incomingFiles.length === 0) return;

  let invalidFound = false;

  incomingFiles.forEach((file) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const alreadyExists = state.files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);

    if (!isPdf) {
      invalidFound = true;
      return;
    }

    if (!alreadyExists) {
      state.files.push(file);
    }
  });

  elements.pdfInput.value = '';
  hideResult();
  renderFiles();
  validateForm();

  if (invalidFound) {
    showModal('Formato incorrecto', 'Solo se permiten archivos PDF.', 'error');
  }
}

function renderFiles() {
  elements.fileList.innerHTML = '';

  if (state.files.length === 0) {
    elements.emptyState.style.display = 'block';
    elements.filesCount.textContent = '0 archivos';
    hideResult();
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.filesCount.textContent = `${state.files.length} ${state.files.length === 1 ? 'archivo' : 'archivos'}`;

  state.files.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <path d="M14 2v6h6"></path>
          <path d="M12 14v3"></path>
          <path d="M10.5 15.5h3"></path>
        </svg>
      </div>
      <div class="file-meta">
        <span class="file-name"></span>
        <span class="file-size">${formatBytes(file.size)}</span>
      </div>
      <button type="button" class="file-remove" aria-label="Eliminar archivo">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    item.querySelector('.file-name').textContent = file.name;
    item.querySelector('.file-remove').addEventListener('click', () => removeFile(index));
    elements.fileList.appendChild(item);
  });
}

function removeFile(index) {
  state.files.splice(index, 1);
  hideResult();
  renderFiles();
  validateForm();
}

function validateForm() {
  const password = elements.passwordInput.value;
  const confirmPassword = elements.confirmPasswordInput.value;
  const hasFiles = state.files.length > 0;
  const longEnough = password.length >= 6;
  const matches = password !== '' && password === confirmPassword;

  if (!password && !confirmPassword) {
    setPasswordStatus('Pendiente', '');
  } else if (!longEnough) {
    setPasswordStatus('Muy corta', 'error');
  } else if (!matches) {
    setPasswordStatus('No coincide', 'error');
  } else {
    setPasswordStatus('Lista', 'match');
  }

  elements.protectBtn.disabled = !(hasFiles && longEnough && matches);
}

function setPasswordStatus(text, type) {
  elements.passwordStatus.textContent = text;
  elements.passwordStatus.className = 'password-status';
  if (type) elements.passwordStatus.classList.add(type);
}

async function protectFiles() {
  if (elements.protectBtn.disabled) return;

  const password = elements.passwordInput.value;
  const zip = state.files.length > 1 ? new window.JSZip() : null;

  setLoadingState(true);
  hideResult();

  try {
    const qpdf = await ensureQpdfLoaded();

    if (state.files.length === 1) {
      updateProgress(20, 'Protegiendo archivo...', '20%');
      const protectedBytes = await protectSinglePdf(qpdf, state.files[0], password, 0);
      const fileName = buildProtectedName(state.files[0].name);
      const blob = new Blob([protectedBytes], { type: 'application/pdf' });
      setDownload(blob, fileName, false);
      elements.resultMessage.textContent = 'Tu PDF ya esta cifrado y listo para descargar.';
    } else {
      for (let index = 0; index < state.files.length; index += 1) {
        const file = state.files[index];
        const percent = Math.round(((index + 1) / state.files.length) * 90);
        updateProgress(percent, `Protegiendo ${index + 1} de ${state.files.length}...`, `${percent}%`);
        const protectedBytes = await protectSinglePdf(qpdf, file, password, index);
        zip.file(buildProtectedName(file.name), protectedBytes);
      }

      updateProgress(96, 'Empaquetando ZIP...', '96%');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      setDownload(zipBlob, 'pdfs_protegidos.zip', true);
      elements.resultMessage.textContent = 'Tus PDFs fueron protegidos con la misma contrasena y empaquetados en un ZIP.';
    }

    updateProgress(100, 'Proteccion completada', '100%');
    elements.resultPanel.style.display = 'block';
    elements.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error(error);
    showModal(
      'No se pudo proteger el PDF',
      getReadableError(error),
      'error'
    );
  } finally {
    setLoadingState(false);
  }
}

async function protectSinglePdf(qpdf, file, password, index) {
  const inputDir = '/work/in';
  const outputDir = '/work/out';
  const inputPath = `${inputDir}/source-${index}.pdf`;
  const outputPath = `${outputDir}/protected-${index}.pdf`;
  const ownerPassword = buildOwnerPassword(password, file.name, index);
  const bytes = new Uint8Array(await file.arrayBuffer());

  safeUnlink(qpdf, inputPath);
  safeUnlink(qpdf, outputPath);
  qpdf.FS.writeFile(inputPath, bytes);

  const command = [
    inputPath,
    '--encrypt',
    password,
    ownerPassword,
    '256',
    '--',
    outputPath
  ];

  qpdf.callMain(command);

  const protectedBytes = qpdf.FS.readFile(outputPath);
  safeUnlink(qpdf, inputPath);
  safeUnlink(qpdf, outputPath);

  return protectedBytes;
}

async function ensureQpdfLoaded() {
  if (state.qpdf) return state.qpdf;

  if (!state.qpdfPromise) {
    state.qpdfPromise = import('https://cdn.jsdelivr.net/npm/qpdf-wasm-esm-embedded@1.1.1/qpdf.mjs')
      .then((module) => {
        const createQpdf = module.default;
        if (typeof createQpdf !== 'function') {
          throw new Error('No se pudo inicializar el motor QPDF');
        }

        return createQpdf({
          print: () => {},
          printErr: (text) => {
            if (text && !String(text).includes('--help')) {
              console.warn('[qpdf]', text);
            }
          }
        });
      })
      .then((instance) => {
        try {
          safeMkdir(instance, '/work');
          safeMkdir(instance, '/work/in');
          safeMkdir(instance, '/work/out');
        } catch (error) {
          console.warn('No se pudieron preparar carpetas de trabajo en QPDF', error);
        }

        state.qpdf = instance;
        return state.qpdf;
      })
      .catch((error) => {
        state.qpdfPromise = null;
        throw error;
      });
  }

  return state.qpdfPromise;
}

function setDownload(blob, fileName, isZip) {
  if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
  state.downloadUrl = URL.createObjectURL(blob);
  elements.downloadLink.href = state.downloadUrl;
  elements.downloadLink.download = fileName;
  elements.downloadLink.innerHTML = isZip
    ? '<i class="fa-solid fa-file-zipper"></i> Descargar ZIP protegido'
    : '<i class="fa-solid fa-download"></i> Descargar PDF protegido';
}

function setLoadingState(isLoading) {
  elements.protectBtn.disabled = isLoading || elements.protectBtn.disabled;
  elements.protectBtnText.style.display = isLoading ? 'none' : 'inline-flex';
  elements.loadingSpinner.style.display = isLoading ? 'inline-block' : 'none';
  elements.progressWrap.style.display = isLoading ? 'block' : 'none';

  if (!isLoading) {
    validateForm();
    setTimeout(() => {
      elements.progressWrap.style.display = 'none';
      updateProgress(0, 'Procesando...', '0%');
    }, 500);
  }
}

function updateProgress(value, label, percentText) {
  elements.progressFill.style.width = `${value}%`;
  elements.progressLabel.textContent = label;
  elements.progressPercent.textContent = percentText;
}

function hideResult() {
  elements.resultPanel.style.display = 'none';
}

function buildProtectedName(originalName) {
  const dotIndex = originalName.toLowerCase().lastIndexOf('.pdf');
  if (dotIndex === -1) return `${originalName}_protegido.pdf`;
  return `${originalName.slice(0, dotIndex)}_protegido.pdf`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
}

function buildOwnerPassword(password, fileName, index) {
  return `${password}::owner::${fileName}::${index}`;
}

function safeMkdir(qpdf, path) {
  try {
    qpdf.FS.mkdir(path);
  } catch (error) {
    if (!String(error.message || error).includes('File exists')) {
      throw error;
    }
  }
}

function safeUnlink(qpdf, path) {
  try {
    qpdf.FS.unlink(path);
  } catch (error) {
    if (!String(error.message || error).includes('No such file')) {
      console.warn('No se pudo limpiar archivo temporal:', path, error);
    }
  }
}

function getReadableError(error) {
  const message = String(error?.message || error || '');

  if (message.includes('abort') || message.includes('Aborted')) {
    return 'El motor de cifrado se detuvo al procesar ese PDF. Prueba con otro archivo o con un PDF menos complejo.';
  }

  if (message.includes('Invalid PDF') || message.includes('parse')) {
    return 'El archivo parece estar danado o no tiene una estructura PDF valida.';
  }

  if (message.includes('remote server') || message.includes('Failed to fetch') || message.includes('import')) {
    return 'No se pudo cargar el motor de proteccion desde la red. Revisa tu conexion e intenta nuevamente.';
  }

  return `Ocurrio un error al cifrar tus archivos: ${message || 'error desconocido'}`;
}

function showModal(title, message, type) {
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modalIcon.className = `modal-icon ${type === 'success' ? 'success' : 'error'}`;
  elements.modalIcon.innerHTML = type === 'success'
    ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
    : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  elements.modal.classList.add('active');
}

function closeModal() {
  elements.modal.classList.remove('active');
}
