// Esperamos a que la librería jsPDF esté disponible globalmente
const { jsPDF } = window.jspdf;

// Referencias a elementos del DOM
const input = document.getElementById('filesInput');
const dropZone = document.getElementById('dropZone');
const listContainer = document.getElementById('fileList');
const listWrapper = document.getElementById('fileListContainer');
const convertBtn = document.getElementById('convertBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const resultBox = document.getElementById('result');
const downloadLink = document.getElementById('downloadLink');

// Variable para almacenar los archivos seleccionados
let selectedFiles = [];

// --- EVENTOS DRAG & DROP ---

// Al arrastrar sobre la zona
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = '#eff6ff'; // Azul muy claro
});

// Al salir de la zona
dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = 'var(--primary-light)';
});

// Al soltar los archivos
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = 'var(--primary-light)';
    
    if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
    }
});

// --- EVENTO DE SELECCIÓN MANUAL ---
input.addEventListener('change', function() {
    if (this.files.length) {
        handleFiles(this.files);
    }
});

// --- FUNCIÓN PARA PROCESAR LOS ARCHIVOS ---
function handleFiles(files) {
    selectedFiles = Array.from(files);
    listContainer.innerHTML = ""; // Limpiar lista visual anterior
    resultBox.style.display = 'none'; // Ocultar caja de descarga si había una

    if (selectedFiles.length > 0) {
        // Mostrar el contenedor de la lista y el botón
        listWrapper.style.display = 'block';

        // Crear elementos visuales para cada archivo
        selectedFiles.forEach(file => {
            let div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <div class="file-icon"><i class="ph-fill ph-image"></i></div>
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">
                    ${file.name}
                </div>
            `;
            listContainer.appendChild(div);
        });
    }
}

// --- LÓGICA DE CONVERSIÓN A PDF ---
convertBtn.addEventListener('click', async function() {
    if (selectedFiles.length === 0) {
        alert("Por favor, selecciona al menos una foto.");
        return;
    }

    // Cambiar estado visual del botón (Loading)
    const originalBtnText = btnText.innerText;
    btnText.innerText = "Generando PDF...";
    convertBtn.disabled = true;
    btnSpinner.style.display = 'block';
    
    // Ocultar icono del PDF temporalmente
    const pdfIcon = document.querySelector('.ph-file-pdf');
    if(pdfIcon) pdfIcon.style.display = 'none';

    try {
        // Pequeño timeout para permitir que la UI se renderice antes de bloquear el hilo
        await new Promise(resolve => setTimeout(resolve, 100));

        // Inicializar documento PDF (A4 Vertical, mm)
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 10;

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            // Leer archivo como Base64
            const imgData = await readFileAsBase64(file);
            
            // Obtener propiedades de la imagen para mantener la proporción
            const imgProps = doc.getImageProperties(imgData);
            
            // Calcular ancho y alto ajustado al ancho de página (menos márgenes)
            const pdfWidth = pageWidth - (margin * 2);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Si no es la primera imagen, añadir nueva página
            if (i > 0) doc.addPage();
            
            // Dibujar imagen (tipo JPEG/PNG se detecta automáticamente o se fuerza)
            // Se usa 'JPEG' como alias genérico en jsPDF para compresión, pero soporta PNG transparente
            doc.addImage(imgData, 'JPEG', margin, margin, pdfWidth, pdfHeight);
        }

        // Generar Blob y URL
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Mostrar resultado
        downloadLink.href = pdfUrl;
        downloadLink.download = "Album_ImaginaTools.pdf";
        resultBox.style.display = 'block'; // Mostrar caja verde
        btnText.innerText = "¡PDF Creado!";

    } catch (error) {
        console.error(error);
        alert("Ocurrió un error. Intenta con imágenes estándar (JPG, PNG).");
        btnText.innerText = "Intentar de nuevo";
    } finally {
        // Restaurar estado del botón
        convertBtn.disabled = false;
        btnSpinner.style.display = 'none';
        if(pdfIcon) pdfIcon.style.display = 'block';
        
        // Si falló o si se quiere permitir otro intento, restaurar texto original si no es éxito
        if(btnText.innerText !== "¡PDF Creado!") {
            btnText.innerText = originalBtnText;
        }
    }
});

// Función auxiliar para leer archivos como DataURL (Base64)
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}