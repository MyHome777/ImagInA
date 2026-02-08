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

// 1. Mostrar cuántos archivos se seleccionaron
fileInput.addEventListener('change', function() {
    if(this.files && this.files.length > 0) {
        if(this.files.length === 1) {
            uploadText.innerText = "✅ " + this.files[0].name;
        } else {
            uploadText.innerText = `✅ ${this.files.length} imágenes seleccionadas`;
        }
        uploadText.style.color = "#4361ee";
        resultDiv.style.display = 'none'; // Ocultar descarga anterior
    }
});

// 2. Botón Principal
processBtn.addEventListener('click', async function() {
    const files = fileInput.files;
    if (files.length === 0) { alert("Sube al menos una imagen."); return; }

    const originalText = processBtn.innerText;
    processBtn.disabled = true;

    try {
        // --- MODO: UN SOLO ARCHIVO ---
        if (files.length === 1) {
            processBtn.innerText = "Procesando... ⏳";
            const resultBlob = await processSingleImage(files[0]);
            
            // Crear URL de descarga directa
            const url = URL.createObjectURL(resultBlob.blob);
            downloadLink.href = url;
            downloadLink.download = `editada_${getFileName(files[0].name, resultBlob.ext)}`;
            downloadLink.innerText = "⬇ Descargar Imagen";
        } 
        // --- MODO: GRUPO (ZIP) ---
        else {
            const zip = new JSZip(); // Creamos el objeto ZIP
            
            for (let i = 0; i < files.length; i++) {
                // Actualizar texto del botón para que el usuario vea progreso
                processBtn.innerText = `Procesando ${i + 1} de ${files.length}... ⏳`;
                
                const result = await processSingleImage(files[i]);
                
                // Añadir al ZIP: (nombre_archivo, datos_blob)
                zip.file(`editada_${getFileName(files[i].name, result.ext)}`, result.blob);
            }

            processBtn.innerText = "Generando ZIP... 📦";
            
            // Generar el archivo .zip final
            const content = await zip.generateAsync({type: "blob"});
            const url = URL.createObjectURL(content);
            
            downloadLink.href = url;
            downloadLink.download = "imagenes_procesadas.zip";
            downloadLink.innerText = "⬇ Descargar ZIP con todas";
        }

        resultDiv.style.display = 'block';

    } catch (error) {
        console.error(error);
        alert("Error al procesar. Intenta con menos imágenes si son muy pesadas.");
    } finally {
        processBtn.innerText = originalText;
        processBtn.disabled = false;
    }
});

// --- FUNCIÓN NÚCLEO: Procesa 1 sola imagen y devuelve el Blob ---
async function processSingleImage(file) {
    const img = await loadImage(file);

    // Calcular dimensiones
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

    // Marca de Agua
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
    
    // Si es PDF
    if (format === 'application/pdf') {
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const orientation = width > height ? 'l' : 'p';
        const pdf = new jsPDF(orientation, 'px', [width, height]);
        pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
        
        // Devolver Blob del PDF
        return { blob: pdf.output('blob'), ext: 'pdf' };
    } 
    // Si es Imagen (PNG, JPG, WEBP)
    else {
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                const ext = format.split('/')[1];
                resolve({ blob: blob, ext: ext });
            }, format, 0.90);
        });
    }
}

// Helpers
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function getFileName(originalName, newExt) {
    // Quita la extensión original y pone la nueva
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    return `${nameWithoutExt}.${newExt}`;
}