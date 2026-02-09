/**
 * MARCA DE AGUA - LÓGICA DEL CLIENTE
 * Autor: ImaginA Tools
 * Versión: 2.0 (Con control de espaciado y SVGs)
 */

// --- VARIABLES DE ESTADO ---
let state = {
    watermarkType: 'text', // 'text' o 'image'
    posMode: 'center',     // 'tiled', 'center', 'corner'
    corner: 'BR',          // 'TL', 'TR', 'BL', 'BR' (Bottom-Right default)
    mainImage: null,       // Objeto Image
    logoImage: null        // Objeto Image (si aplica)
};

// --- DOM ELEMENTS ---
const mainInput = document.getElementById('mainImageInput');
const configPanel = document.getElementById('configPanel');
const processBtn = document.getElementById('processBtn');
const resultArea = document.getElementById('resultArea');
const resultPreview = document.getElementById('resultPreview');
const downloadBtn = document.getElementById('downloadBtn');

// Sliders (Tamaño, Espaciado, Opacidad)
const sizeRange = document.getElementById('sizeRange');
const sizeVal = document.getElementById('sizeVal');

const spacingBox = document.getElementById('spacingBox');     // Contenedor del slider nuevo
const spacingRange = document.getElementById('spacingRange'); // El input range nuevo
const spacingVal = document.getElementById('spacingVal');     // El valor de texto

const opacityRange = document.getElementById('opacityRange');
const opacityVal = document.getElementById('opacityVal');

// --- ICONOS SVG (Strings para inyección dinámica) ---
const icons = {
    loading: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite; margin-right: 8px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`,
    process: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
};

// Inyectamos estilo de animación para el spinner directamente
const styleSheet = document.createElement("style");
styleSheet.innerText = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);


// --- EVENT LISTENERS UI ---

// 1. Cargar Imagen Principal
mainInput.addEventListener('change', async function(e) {
    if (e.target.files && e.target.files[0]) {
        try {
            state.mainImage = await loadImage(e.target.files[0]);
            
            // Mostrar preview pequeño
            const preview = document.getElementById('mainImagePreview');
            preview.src = state.mainImage.src;
            preview.style.display = 'block';
            
            // Ocultar texto de subida si existe
            const uploadText = document.getElementById('mainUploadText');
            if(uploadText) uploadText.style.display = 'none';
            
            // Mostrar panel de configuración con animación
            configPanel.style.display = 'block';
            configPanel.animate([
                { opacity: 0, transform: 'translateY(20px)' }, 
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 400, easing: 'ease-out' });
            
            resultArea.style.display = 'none'; // Ocultar resultado anterior
        } catch (error) {
            showModal('Error', 'No se pudo cargar la imagen. Intenta con otra.', true);
        }
    }
});

// 2. Cargar Logo (Si el usuario elige Logo)
document.getElementById('logoInput').addEventListener('change', async function(e) {
    if (e.target.files && e.target.files[0]) {
        try {
            state.logoImage = await loadImage(e.target.files[0]);
            const fileNameLabel = document.getElementById('logoFileName');
            fileNameLabel.textContent = e.target.files[0].name;
            fileNameLabel.style.color = '#4361ee';
            fileNameLabel.style.fontWeight = '600';
        } catch (error) {
            showModal('Error', 'El logo no es válido.', true);
        }
    }
});

// 3. Sliders visuales
sizeRange.addEventListener('input', (e) => sizeVal.textContent = e.target.value + '%');
opacityRange.addEventListener('input', (e) => opacityVal.textContent = e.target.value + '%');

// Listener para el nuevo slider de Espaciado
spacingRange.addEventListener('input', (e) => {
    // Convertir valor raw (0-300) a formato legible "1.0x"
    const val = (e.target.value / 100).toFixed(1);
    spacingVal.textContent = val + 'x';
});

// 4. Botón Procesar
processBtn.addEventListener('click', async function() {
    if (!state.mainImage) return showModal('Falta Imagen', 'Por favor sube una imagen principal primero.', true);
    
    // Validar si eligió logo pero no subió nada
    if (state.watermarkType === 'image' && !state.logoImage) {
        return showModal('Falta Logo', 'Seleccionaste "Logo" pero no has subido el archivo.', true);
    }
    
    // UI Loading (Con SVG Spinner)
    const originalBtnContent = processBtn.innerHTML;
    processBtn.innerHTML = `${icons.loading} Procesando...`;
    processBtn.disabled = true;
    processBtn.style.opacity = '0.7';

    // Timeout para permitir renderizado del UI
    setTimeout(async () => {
        try {
            const resultBlob = await applyWatermark();
            
            // Mostrar resultado
            const url = URL.createObjectURL(resultBlob);
            resultPreview.src = url;
            downloadBtn.href = url;
            
            resultArea.style.display = 'block';
            resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            showModal('¡Listo!', 'Tu imagen ha sido procesada correctamente.', false);

        } catch (error) {
            console.error(error);
            showModal('Error', 'Ocurrió un error inesperado al procesar.', true);
        } finally {
            // Restaurar botón
            processBtn.innerHTML = originalBtnContent;
            processBtn.disabled = false;
            processBtn.style.opacity = '1';
        }
    }, 300);
});


// --- FUNCIONES DE CONTROL DE ESTADO (UI) ---

function setWatermarkType(type) {
    state.watermarkType = type;
    
    // Toggle Tabs UI
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    
    if (type === 'text') tabs[0].classList.add('active');
    else tabs[1].classList.add('active');

    // Toggle Input Groups
    document.getElementById('textInputGroup').style.display = type === 'text' ? 'block' : 'none';
    document.getElementById('logoInputGroup').style.display = type === 'image' ? 'block' : 'none';
}

function setPosMode(mode) {
    state.posMode = mode;
    
    // UI Cards Selected State
    document.querySelectorAll('.pos-card').forEach(c => c.classList.remove('selected'));
    
    // Resetear colores de iconos
    document.querySelectorAll('.pos-card svg').forEach(s => s.setAttribute('stroke', '#64748b'));
    document.querySelectorAll('.pos-card circle[fill]').forEach(c => c.setAttribute('fill', 'transparent'));

    // Activar tarjeta seleccionada
    const activeCard = document.getElementById(mode === 'tiled' ? 'optTiled' : mode === 'center' ? 'optCenter' : 'optCorner');
    activeCard.classList.add('selected');
    activeCard.querySelector('svg').setAttribute('stroke', '#4361ee');
    
    // 1. Mostrar/Ocultar selector de esquinas
    document.getElementById('cornerSelector').style.display = mode === 'corner' ? 'grid' : 'none';

    // 2. Mostrar/Ocultar Slider de Espaciado (Solo en Mosaico)
    if (spacingBox) {
        spacingBox.style.display = mode === 'tiled' ? 'block' : 'none';
    }
}

function setCorner(c) {
    state.corner = c;
    const btns = document.getElementById('cornerSelector').children;
    // Limpiar selección previa
    for(let btn of btns) btn.classList.remove('selected');
    
    // Seleccionar nuevo
    if(c==='TL') btns[0].classList.add('selected');
    if(c==='TR') btns[1].classList.add('selected');
    if(c==='BL') btns[2].classList.add('selected');
    if(c==='BR') btns[3].classList.add('selected');
}


// --- LÓGICA CORE (CANVAS) ---

async function applyWatermark() {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const w = state.mainImage.width;
        const h = state.mainImage.height;
        
        canvas.width = w;
        canvas.height = h;
        
        // 1. Dibujar Imagen Base
        ctx.drawImage(state.mainImage, 0, 0, w, h);
        
        // 2. Configurar Estilos de Marca
        ctx.globalAlpha = parseInt(opacityRange.value) / 100;
        const scalePercent = parseInt(sizeRange.value) / 100;
        
        // Determinar qué vamos a dibujar (Texto o Imagen)
        let wmObj = null; 
        let wmWidth, wmHeight;
        
        if (state.watermarkType === 'text') {
            const text = document.getElementById('watermarkText').value || '© ImaginA';
            const color = document.getElementById('textColor').value;
            
            // Tamaño de fuente dinámico
            const baseFontSize = w * 0.05; 
            const fontSize = Math.max(12, baseFontSize * (scalePercent * 5)); 
            
            ctx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`; // Usamos Inter si está cargada
            ctx.fillStyle = color;
            ctx.textBaseline = 'middle';
            
            const metrics = ctx.measureText(text);
            wmWidth = metrics.width;
            wmHeight = fontSize; 
            wmObj = { type: 'text', content: text };
            
        } else {
            // Es Logo
            wmObj = { type: 'image', content: state.logoImage };
            const ratio = state.logoImage.width / state.logoImage.height;
            wmWidth = w * scalePercent; 
            wmHeight = wmWidth / ratio;
        }
        
        // 3. Lógica de Posicionamiento
        const padding = w * 0.03; // Margen dinámico (3%)
        
        if (state.posMode === 'center') {
            const x = (w - wmWidth) / 2;
            const y = (h - wmHeight) / 2;
            drawElement(ctx, wmObj, x, y, wmWidth, wmHeight);
        } 
        else if (state.posMode === 'corner') {
            let x, y;
            // Ajuste vertical para texto (el baseline 'middle' requiere compensación)
            const textYOffset = (wmObj.type === 'text' ? wmHeight/2 : 0);
            
            switch(state.corner) {
                case 'TL': x = padding; y = padding + textYOffset; break;
                case 'TR': x = w - wmWidth - padding; y = padding + textYOffset; break;
                case 'BL': x = padding; y = h - wmHeight - padding + textYOffset; break;
                case 'BR': x = w - wmWidth - padding; y = h - wmHeight - padding + textYOffset; break;
            }
            drawElement(ctx, wmObj, x, y, wmWidth, wmHeight);
        } 
        else if (state.posMode === 'tiled') {
            // --- NUEVA LÓGICA DE MOSAICO AVANZADA ---
            ctx.save();
            
            // Rotación (-30 grados)
            ctx.translate(w/2, h/2);
            ctx.rotate(-Math.PI / 6); 
            ctx.translate(-w/2, -h/2);
            
            // Recuperar valor del slider de espaciado (0 a 300) -> Factor 0.0 a 3.0
            const spacingFactor = parseInt(spacingRange.value) / 100;
            
            const gapX = wmWidth * spacingFactor;
            const gapY = wmHeight * spacingFactor;
            
            // Área extendida para cubrir la rotación
            // Usamos un bucle más amplio para asegurar cobertura en esquinas rotadas
            const diag = Math.sqrt(w*w + h*h); // Diagonal de la imagen
            
            for (let dy = -diag; dy < h + diag; dy += (wmHeight + gapY)) {
                // Cálculo de índice de fila para efecto "ladrillo"
                const rowIndex = Math.floor(dy / (wmHeight + gapY));
                
                for (let dx = -diag; dx < w + diag; dx += (wmWidth + gapX)) {
                    // Desplazar filas pares la mitad del ancho (Efecto Ladrillo)
                    const offsetX = (rowIndex % 2 !== 0) ? (wmWidth + gapX) / 2 : 0;
                    
                    drawElement(ctx, wmObj, dx + offsetX, dy, wmWidth, wmHeight);
                }
            }
            ctx.restore();
        }
        
        // 4. Exportar
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

function drawElement(ctx, obj, x, y, w, h) {
    if (obj.type === 'text') {
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 4;
        ctx.fillText(obj.content, x, y);
        ctx.shadowBlur = 0; 
    } else {
        ctx.drawImage(obj.content, x, y, w, h);
    }
}

// Helpers
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

// Modal Helpers
function showModal(title, msg, isError) {
    const modal = document.getElementById('customModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = msg;
    document.getElementById('modalIconError').style.display = isError ? 'flex' : 'none';
    document.getElementById('modalIconSuccess').style.display = isError ? 'none' : 'flex';
    modal.classList.add('active');
}

window.closeModal = function() {
    document.getElementById('customModal').classList.remove('active');
}