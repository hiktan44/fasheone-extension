// Ürün resimlerini bulma
function findProductImages() {
    const selectors = [
        // Trendyol spesifik
        '.product-image-container img',
        '.gallery-container img',
        '.product-box-container img',
        '.product-stamp img',
        '.product-card img',
        // Genel selektörler
        'img.product-image',
        'img.product-img',
        '.product-detail img',
        '.product-gallery img',
        '.product img',
        '[data-image]',
        '.gallery img'
    ];

    return Array.from(document.querySelectorAll(selectors.join(',')))
        .filter(img => {
            if (!img.src || !img.complete) return false;
            if (img.closest('.fasheone-container')) return false;
            
            // Boyut kontrolü
            const rect = img.getBoundingClientRect();
            const minSize = 100;
            return rect.width >= minSize && rect.height >= minSize;
        });
}

// Dene butonu oluşturma
function createTryButton(img) {
    if (img.closest('.fasheone-container')) return;

    const container = document.createElement('div');
    container.className = 'fasheone-container';

    const imgClone = img.cloneNode(true);
    container.appendChild(imgClone);

    const button = document.createElement('button');
    button.className = 'fasheone-try-button';
    button.innerHTML = '<span class="fasheone-icon">👕</span><span class="fasheone-text">Dene</span>';

    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Resmi storage'a kaydet ve popup'ı aç
        saveImageAndOpenPopup(imgClone.src);
    });

    container.appendChild(button);
    img.parentNode.replaceChild(container, img);
}

// Resmi kaydet ve popup'ı aç
function saveImageAndOpenPopup(imageUrl) {
    try {
        // Önce storage'a kaydet
        chrome.storage.local.set({
            selectedImage: imageUrl,
            lastSelected: Date.now()
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('Storage error:', chrome.runtime.lastError);
                showNotification('Resim kaydedilemedi', 'error');
                return;
            }

            // Sonra service worker'a bildir
            chrome.runtime.sendMessage({
                type: 'SELECTED_IMAGE',
                imageUrl: imageUrl
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Message error:', chrome.runtime.lastError);
                    showNotification('Popup açılamadı', 'error');
                    return;
                }

                if (response && response.success) {
                    showNotification('Resim seçildi', 'success');
                }
            });
        });
    } catch (error) {
        console.error('SaveImage error:', error);
        showNotification('Bir hata oluştu', 'error');
    }
}

// Bildirim gösterme
function showNotification(message, type) {
    const existingNotification = document.querySelector('.fasheone-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `fasheone-notification ${type}`;
    notification.textContent = message;

    // Stil değerlerini inline olarak ekle
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 4px;
        color: white;
        font-size: 14px;
        z-index: 999999;
        background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        animation: fadeIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Butonları başlat
function initializeTryButtons() {
    const images = findProductImages();
    images.forEach(createTryButton);
}

// Sayfa yüklendiğinde başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTryButtons);
} else {
    initializeTryButtons();
}

// DOM değişikliklerini izle
const observer = new MutationObserver(() => {
    requestAnimationFrame(() => {
        initializeTryButtons();
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Stil ekle
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);