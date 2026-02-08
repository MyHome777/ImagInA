// Importamos la librería PDFLib
const { PDFDocument } = PDFLib;

// 1. Referencias a los elementos del HTML
const pdfInput = document.getElementById('pdfInput');
const uploadText = document.getElementById('uploadText');
const mergeBtn = document.getElementById('mergeBtn'); // El botón de acción
const resultDiv = document.getElementById('result');
const downloadLink = document.getElementById('downloadLink');

// 2. Escuchar cuando el usuario sube archivos
pdfInput.addEventListener('change', function() {
    if(this.files.length > 0) {
        uploadText.innerText = `✅ ${this.files.length} archivos listos`;
        // Efecto visual: cambiar color a verde oscuro para confirmar
        uploadText.style.color = "#059669"; 
    } else {
        uploadText.innerText = "Selecciona tus PDFs";
        uploadText.style.color = "#e11d48";
    }
});

// 3. Escuchar el clic en "Fusionar Documentos"
mergeBtn.addEventListener('click', async function() {
    
    // Validación: Necesitamos al menos 2 PDFs
    if (pdfInput.files.length < 2) { 
        alert("Necesitas seleccionar al menos 2 PDFs para unirlos."); 
        return; 
    }

    // Feedback visual (Cargando...)
    const originalText = mergeBtn.innerText;
    mergeBtn.innerText = "Uniendo... ⚙️";
    mergeBtn.disabled = true;

    try {
        // --- MOTOR DE FUSIÓN (Sin servidor) ---
        
        // Creamos un documento nuevo y vacío
        const mergedPdf = await PDFDocument.create();

        // Recorremos cada archivo que el usuario subió
        for (let i = 0; i < pdfInput.files.length; i++) {
            const file = pdfInput.files[i];
            
            // Leemos el archivo como "ArrayBuffer" (bytes puros)
            const fileBytes = await readFileAsArrayBuffer(file);
            
            // Cargamos el PDF en la memoria
            const pdf = await PDFDocument.load(fileBytes);
            
            // Copiamos todas las páginas de ese PDF
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            
            // Las pegamos en nuestro documento nuevo
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        // Guardamos el resultado final
        const pdfBytes = await mergedPdf.save();
        
        // Creamos el enlace de descarga
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        downloadLink.href = url;
        downloadLink.download = "Imagina_Fusionado.pdf";
        
        // Mostramos el resultado
        resultDiv.style.display = 'block';
        
    } catch (error) {
        console.error(error);
        alert("Error al unir. Verifica que los PDFs no tengan contraseña.");
    } finally {
        // Restauramos el botón
        mergeBtn.innerText = originalText;
        mergeBtn.disabled = false;
    }
});

// Función auxiliar para leer archivos
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}