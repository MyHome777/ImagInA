// Esperamos a que la librería cargue
const { jsPDF } = window.jspdf;

// 1. Referencias al DOM (Elementos HTML)
const input = document.getElementById('filesInput');
const listContainer = document.getElementById('fileList');
const convertBtn = document.getElementById('convertBtn');
const resultBox = document.getElementById('result');
const downloadLink = document.getElementById('downloadLink');

// Variable para guardar los archivos seleccionados
let selectedFiles = [];

// 2. Escuchar cuando el usuario elige fotos
input.addEventListener('change', function() {
    listContainer.innerHTML = ""; // Limpiar lista anterior
    selectedFiles = Array.from(this.files); // Convertir a Array real

    if(selectedFiles.length > 0) {
        // Ocultar resultado anterior si hay uno
        resultBox.style.display = 'none';
        
        // Mostrar lista de archivos visualmente
        selectedFiles.forEach(file => {
            let div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `<span>📷</span> ${file.name}`;
            listContainer.appendChild(div);
        });
    }
});

// 3. Escuchar el click en "Convertir"
convertBtn.addEventListener('click', async function() {
    if (selectedFiles.length === 0) {
        alert("Por favor, selecciona al menos una foto.");
        return;
    }

    // Cambiar estado del botón (Feedback visual)
    const originalText = convertBtn.innerText;
    convertBtn.innerText = "Procesando imágenes... ⏳";
    convertBtn.disabled = true;

    try {
        // --- INICIO DEL MOTOR DE PDF (Reemplazo del Backend) ---
        
        // Crear documento PDF (A4, mm, vertical)
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 10;

        // Recorrer cada archivo seleccionado
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            // Convertir la imagen a un formato que JS entienda (Base64)
            const imgData = await readFileAsBase64(file);
            
            // Calcular dimensiones para que la foto quepa bien en la hoja A4
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = pageWidth - (margin * 2);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Si es la segunda foto o más, añadimos una página nueva
            if (i > 0) doc.addPage();

            // Dibujar la imagen en el PDF
            // (imagen, formato, x, y, ancho, alto)
            doc.addImage(imgData, 'JPEG', margin, margin, pdfWidth, pdfHeight);
        }

        // Guardar el PDF como un "Blob" (archivo en memoria)
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // --- FIN DEL MOTOR ---

        // Configurar el botón de descarga
        downloadLink.href = pdfUrl;
        downloadLink.download = "Album_ImaginaTools.pdf";
        
        // Mostrar la cajita verde de descarga
        resultBox.style.display = 'block';

    } catch (error) {
        console.error(error);
        alert("Ocurrió un error al procesar las imágenes. Intenta con menos fotos.");
    } finally {
        // Restaurar el botón original
        convertBtn.innerText = originalText;
        convertBtn.disabled = false;
    }
});

// Función auxiliar para leer el archivo como datos (Promesa)
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}