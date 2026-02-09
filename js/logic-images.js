// Referencias
const fileInput = document.getElementById('fileInput');
const uploadText = document.getElementById('uploadText');
const formatSelect = document.getElementById('formatSelect');
const inputMarca = document.getElementById('inputMarca');
const inputW = document.getElementById('inputW');
const inputH = document.getElementById('inputH');
const processBtn = document.getElementById('processBtn');
const resultDiv = document.getElementById('result');
const downloadLink = document.getElementById('downloadLink');
const progressInfo = document.getElementById('progressInfo');
const progressBar = document.getElementById('progressBar');
const progressBarFill = document.getElementById('progressBarFill');
const progressLabel = document.getElementById('progressLabel');

// --- LÓGICA DEL MODAL (Agregado para estética) ---
// Asegúrate de haber pegado el HTML y CSS del modal que te pasé antes
function showModal(title, message, isError = true) {
    const modal = document.getElementById('customModal');
    if (!modal) { alert(message); return; } // Respaldo por si no pusiste el HTML

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    
    if (isError) {
        document.getElementById('modalIconError').style.display = 'flex';
        document.getElementById('modalIconSuccess').style.display = 'none';
    } else {
        document.getElementById('modalIconError').style.display = 'none';
        document.getElementById('modalIconSuccess').style.display = 'flex';
    }
    
    modal.classList.add('active');
}
// Función global para cerrar (necesaria para el botón del HTML)
window.closeModal = function() {
    const modal = document.getElementById('customModal');
    if (modal) modal.classList.remove('active');
}


// 1. Mostrar cuántos archivos se seleccionaron (CÓDIGO ORIGINAL TUYO RESTAURADO)
fileInput.addEventListener('change', function() {
    if(this.files && this.files.length > 0) {
        // Usar SVG en lugar de emoji para una apariencia consistente
        const checkSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:6px;"><circle cx="12" cy="12" r="10"></circle><path d="M9 12l2 2 4-4"></path></svg>';
        if(this.files.length === 1) {
            uploadText.innerHTML = checkSvg + '<span class="upload-name"></span>';
            uploadText.querySelector('.upload-name').textContent = this.files[0].name;
        } else {
            uploadText.innerHTML = checkSvg + '<span class="upload-name"></span>';
            uploadText.querySelector('.upload-name').textContent = `${this.files.length} imágenes seleccionadas`;
        }
        uploadText.style.color = "#4361ee";
        resultDiv.style.display = 'none'; // Ocultar descarga anterior
    }
});

// 2. Botón Principal
processBtn.addEventListener('click', async function() {
    const files = fileInput.files;
    if (files.length === 0) { 
        showModal("Atención", "Sube al menos una imagen.", true); 
        return; 
    }

    const originalText = processBtn.innerHTML; // Guardamos el HTML interno (iconos)
    processBtn.disabled = true;

    try {
        // Mostrar barra de progreso
        progressBar.style.display = 'block';
        progressInfo.style.display = 'none';
        
        // --- MODO: UN SOLO ARCHIVO ---
        if (files.length === 1) {
            progressLabel.textContent = 'Procesando imagen...';
            progressBarFill.style.width = '50%';
            
            const resultBlob = await processSingleImage(files[0]);
            
            // Actualizar barra al 100%
            progressBarFill.style.width = '100%';
            
            // Crear URL de descarga directa
            const url = URL.createObjectURL(resultBlob.blob);
            downloadLink.href = url;
            downloadLink.download = `editada_${getFileName(files[0].name, resultBlob.ext)}`;
            downloadLink.innerHTML = "⬇ Descargar Imagen";
        } 
        // --- MODO: GRUPO (ZIP) ---
        else {
            const zip = new JSZip(); 
            
            for (let i = 0; i < files.length; i++) {
                // Actualizar progreso
                const percent = Math.round(((i + 1) / files.length) * 100);
                progressLabel.textContent = `Procesando ${i + 1} de ${files.length} imágenes...`;
                progressBarFill.style.width = percent + '%';
                
                const result = await processSingleImage(files[i]);
                
                // Añadir al ZIP
                zip.file(`editada_${getFileName(files[i].name, result.ext)}`, result.blob);
            }
            
            progressLabel.textContent = 'Generando ZIP...';
            progressBarFill.style.width = '95%';
            
            // Generar el archivo .zip final
            const content = await zip.generateAsync({type: "blob"});
            const url = URL.createObjectURL(content);
            
            downloadLink.href = url;
            downloadLink.download = "imagenes_procesadas.zip";
            const zipIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
            downloadLink.innerHTML = zipIcon + "Descargar ZIP con todas";
            
            progressBarFill.style.width = '100%';
            showModal("¡Proceso Finalizado!", `Se procesaron correctamente ${files.length} imágenes.`, false);
        }

        resultDiv.style.display = 'block';

    } catch (error) {
        console.error(error);
        showModal("Error", "Error al procesar. Intenta con menos imágenes si son muy pesadas o de muy alta resolución.", true);
    } finally {
        processBtn.innerHTML = originalText;
        processBtn.disabled = false;
        progressBar.style.display = 'none';
    }
});

// --- FUNCIÓN NÚCLEO OPTIMIZADA (AQUÍ ESTÁ LA SOLUCIÓN AL ERROR) ---
async function processSingleImage(file) {
    // 1. Cargar imagen SIN FileReader (Usa menos memoria RAM)
    const img = await loadImageOptimized(file);

    // Calcular dimensiones (Lógica original intacta)
    let width = parseInt(inputW.value) || img.width;
    let height = parseInt(inputH.value) || img.height;

    if (inputW.value && !inputH.value) {
        const ratio = img.height / img.width;
        height = width * ratio;
    } else if (!inputW.value && inputH.value) {
        const ratio = img.width / img.height;
        width = height * ratio;
    }

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Dibujar
    ctx.drawImage(img, 0, 0, width, height);

    // IMPORTANTE: Liberar la memoria de la imagen original una vez dibujada
    // Esto evita que el navegador colapse con muchas fotos
    if (img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
    }

    // Marca de Agua (Lógica original intacta)
    const marcaTexto = inputMarca.value.trim();
    if (marcaTexto) {
        const fontSize = Math.floor(width * 0.05); 
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(marcaTexto, width - 20 + 2, height - 20 + 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(marcaTexto, width - 20, height - 20);
    }

    // Exportar
    const format = formatSelect.value;
    
    if (format === 'application/pdf') {
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const orientation = width > height ? 'l' : 'p';
        const pdf = new jsPDF(orientation, 'px', [width, height]);
        pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
        
        return { blob: pdf.output('blob'), ext: 'pdf' };
    } 
    else {
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                const ext = format.split('/')[1];
                resolve({ blob: blob, ext: ext });
            }, format, 0.90);
        });
    }
}

// NUEVO HELPER OPTIMIZADO
// Reemplaza al anterior 'loadImage' que usaba FileReader
function loadImageOptimized(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // createObjectURL crea un enlace directo al archivo en disco
        // No carga el archivo pesado en la memoria del JS
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => resolve(img);
        img.onerror = (e) => {
            URL.revokeObjectURL(objectUrl);
            reject(e);
        };
        img.src = objectUrl;
    });
}

function getFileName(originalName, newExt) {
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    return `${nameWithoutExt}.${newExt}`;
}