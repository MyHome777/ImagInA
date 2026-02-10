document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN ---
    // Tu URL de Hugging Face + el endpoint /convertir
    const API_URL = "https://cognetixinnovations-api-conversor-pdf.hf.space/convertir";

    // --- ELEMENTOS DEL DOM ---
    const elements = {
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('pdfInput'),
        uploadPrompt: document.getElementById('uploadPrompt'),
        fileInfo: document.getElementById('fileInfo'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        removeFileBtn: document.getElementById('removeFileBtn'),
        convertBtn: document.getElementById('convertBtn'),
        btnText: document.querySelector('.btn-text'),
        loadingSpinner: document.getElementById('loadingSpinner'),
        resultArea: document.getElementById('resultArea'),
        downloadLink: document.getElementById('downloadLink'),
        // Modal elements
        modal: document.getElementById('customModal'),
        modalTitle: document.getElementById('modalTitle'),
        modalMessage: document.getElementById('modalMessage'),
        modalIcon: document.getElementById('modalIcon')
    };

    let currentFile = null;

    // --- 1. GESTIÓN DE ARRASTRAR Y SOLTAR (DRAG & DROP) ---
    
    // Prevenir comportamientos por defecto
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Efectos visuales al arrastrar
    ['dragenter', 'dragover'].forEach(eventName => {
        elements.dropZone.addEventListener(eventName, () => elements.dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        elements.dropZone.addEventListener(eventName, () => elements.dropZone.classList.remove('dragover'), false);
    });

    // Soltar archivo
    elements.dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // --- 2. GESTIÓN DE INPUT TRADICIONAL ---
    
    // --- 2. GESTIÓN DE INPUT TRADICIONAL ---
    
    // Clic en la zona dispara el input oculto
    elements.dropZone.addEventListener('click', (e) => {
        // Evitar que se dispare si hacemos clic en el botón de eliminar
        if (e.target.closest('#removeFileBtn')) return;

        // --- CORRECCIÓN AQUÍ ---
        // Si el usuario hizo clic directamente en el input (que es invisible pero ocupa todo el espacio),
        // no necesitamos disparar el clic manualmente otra vez, porque el navegador ya lo hizo.
        if (e.target === elements.fileInput) return; 
        // -----------------------

        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });
    // --- 3. LÓGICA DE ARCHIVOS ---

    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];

        // Validación: Solo PDF
        if (file.type !== 'application/pdf') {
            showModal('Formato Incorrecto', 'Por favor, sube únicamente archivos PDF.', 'error');
            return;
        }

        currentFile = file;
        updateUIcjFile(file);
    }

    function updateUIcjFile(file) {
        // Ocultar prompt, mostrar info del archivo
        elements.uploadPrompt.style.display = 'none';
        elements.fileInfo.style.display = 'flex';
        
        // Actualizar datos
        elements.fileName.textContent = file.name;
        elements.fileSize.textContent = formatBytes(file.size);

        // Activar botón
        elements.convertBtn.classList.add('active');
        elements.convertBtn.disabled = false;
        
        // Ocultar resultados previos si los hay
        elements.resultArea.style.display = 'none';
    }

    // Botón eliminar archivo seleccionado
    elements.removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar abrir el explorador de archivos
        resetFile();
    });

    function resetFile() {
        currentFile = null;
        elements.fileInput.value = ''; // Limpiar input para permitir seleccionar el mismo archivo
        elements.uploadPrompt.style.display = 'flex'; // Volver a mostrar flex para centrar
        elements.fileInfo.style.display = 'none';
        elements.convertBtn.classList.remove('active');
        elements.convertBtn.disabled = true;
        elements.resultArea.style.display = 'none';
    }

    // --- 4. CONEXIÓN CON LA API (BACKEND) ---

    elements.convertBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        setLoadingState(true);

        const formData = new FormData();
        formData.append('file', currentFile);

        try {
            // Llamada a la API
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Error del servidor (${response.status})`);
            }

            // Convertir respuesta a Blob (Archivo)
            const blob = await response.blob();
            
            // Crear URL de descarga
            const url = window.URL.createObjectURL(blob);
            
            // Configurar botón de descarga
            elements.downloadLink.href = url;
            const newName = currentFile.name.replace('.pdf', '') + '_editable.docx';
            elements.downloadLink.download = newName;

            // Mostrar resultado
            elements.resultArea.style.display = 'block';
            
            // Scroll suave hacia el resultado
            elements.resultArea.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error(error);
            let msg = 'Hubo un error al procesar tu archivo.';
            
            // Mensaje específico para "Cold Start" de Hugging Face
            if (error.message.includes('503') || error.message.includes('504')) {
                msg = 'El servidor se está iniciando. Por favor, intenta de nuevo en 30 segundos.';
            } else if (error.message.includes('Failed to fetch')) {
                msg = 'No se pudo conectar con el servidor. Verifica tu conexión o intenta más tarde.';
            }

            showModal('Error de Conversión', msg, 'error');
        } finally {
            setLoadingState(false);
        }
    });

    // --- 5. FUNCIONES AUXILIARES ---

    function setLoadingState(isLoading) {
        if (isLoading) {
            elements.btnText.style.display = 'none';
            elements.loadingSpinner.style.display = 'block'; // Block para que se vea el spinner
            elements.convertBtn.disabled = true;
            elements.convertBtn.style.cursor = 'wait';
        } else {
            elements.btnText.style.display = 'block';
            elements.loadingSpinner.style.display = 'none';
            elements.convertBtn.disabled = false;
            elements.convertBtn.style.cursor = 'pointer';
        }
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // --- 6. GESTIÓN DEL MODAL ---

    // Función global para cerrar modal (para el onclick del HTML)
    window.closeModal = function() {
        elements.modal.classList.remove('active');
    };

    function showModal(title, message, type) {
        elements.modalTitle.textContent = title;
        elements.modalMessage.textContent = message;
        
        // Estilos según tipo
        if (type === 'error') {
            elements.modalIcon.className = 'modal-icon error';
            elements.modalIcon.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        } else {
            elements.modalIcon.className = 'modal-icon success';
            // Icono check...
        }
        
        elements.modal.classList.add('active');
    }

    // Cerrar modal al hacer clic fuera del contenido
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeModal();
        }
    });
});