document.addEventListener('DOMContentLoaded', () => {
    // DOM elementleri
    const selectedImage = document.getElementById('selectedProductImage');
    const productPlaceholder = document.getElementById('productImagePlaceholder');
    const userImage = document.getElementById('userImage');
    const userImagePlaceholder = userImage.parentElement.querySelector('.image-placeholder');
    const tryOnBtn = document.querySelector('.try-on-btn');
    const uploadBtn = document.querySelector('.upload-btn');
    const categoryBtns = document.querySelectorAll('.category-btn');

    let selectedCategory = 'dress';
    let currentJobId = null;
    let statusCheckInterval = null;

    // Storage'dan seçili resmi yükle
    chrome.storage.local.get(['selectedImage'], (result) => {
        if (result.selectedImage) {
            console.log('Loading stored image:', result.selectedImage);
            displayProductImage(result.selectedImage);
        }
    });

    function startStatusCheck(jobId) {
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }

        let attempts = 0;
        const maxAttempts = 60; // 2 dakika (2s aralıklarla)

        statusCheckInterval = setInterval(() => {
            if (attempts >= maxAttempts) {
                clearInterval(statusCheckInterval);
                showNotification('İşlem zaman aşımına uğradı', 'error');
                hideLoading();
                return;
            }

            chrome.runtime.sendMessage({
                type: 'CHECK_STATUS',
                jobId: jobId
            }, response => {
                if (!response.success) {
                    clearInterval(statusCheckInterval);
                    showNotification(response.error || 'Durum kontrolünde hata', 'error');
                    hideLoading();
                    return;
                }

                const status = response.data.status;
                console.log('Job status:', status);

                switch (status) {
                    case 'completed':
                        clearInterval(statusCheckInterval);
                        hideLoading();
                        displayResult(response.data.output);
                        break;
                    
                    case 'failed':
                        clearInterval(statusCheckInterval);
                        hideLoading();
                        showNotification('İşlem başarısız oldu', 'error');
                        break;
                }

                attempts++;
            });
        }, 2000); // 2 saniye aralıklarla kontrol et
    }

    function displayResult(output) {
        // Sonuç görüntüleme bölümü oluştur
        const resultDiv = document.createElement('div');
        resultDiv.className = 'result-container';
        
        const resultImage = document.createElement('img');
        resultImage.src = output[0]; // İlk sonucu göster
        resultImage.className = 'result-image';
        
        resultDiv.appendChild(resultImage);
        
        // Önceki sonuç varsa kaldır
        const existingResult = document.querySelector('.result-container');
        if (existingResult) {
            existingResult.remove();
        }
        
        // Yeni sonucu ekle
        document.querySelector('.try-on-container').appendChild(resultDiv);
        showNotification('Deneme tamamlandı!', 'success');
    }

    // Kategori seçimi
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCategory = btn.dataset.category;
        });
    });

    // Kullanıcı fotoğrafı yükleme
    uploadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const base64Image = await fileToBase64(file);
                    userImage.src = base64Image;
                    userImage.style.display = 'block';
                    userImagePlaceholder.style.display = 'none';
                    updateTryOnButton();
                } catch (error) {
                    console.error('Fotoğraf yükleme hatası:', error);
                    showNotification('Fotoğraf yüklenemedi', 'error');
                }
            }
        };

        input.click();
    });

    // Try On işlemi
    tryOnBtn.addEventListener('click', async () => {
        if (!userImage.src || !selectedImage.src) {
            showNotification('Lütfen iki resmi de yükleyin', 'error');
            return;
        }

        try {
            showLoading();
            const garmentBase64 = await getBase64FromUrl(selectedImage.src);
            const modelBase64 = await getBase64FromUrl(userImage.src);

            chrome.runtime.sendMessage({
                type: 'PROCESS_IMAGE',
                modelImage: modelBase64,
                garmentImage: garmentBase64,
                category: selectedCategory
            }, response => {
                if (response && response.success && response.data.id) {
                    currentJobId = response.data.id;
                    startStatusCheck(currentJobId);
                    showNotification('İşlem başlatıldı', 'success');
                } else {
                    hideLoading();
                    showNotification(response?.error || 'Bir hata oluştu', 'error');
                }
            });
        } catch (error) {
            hideLoading();
            showNotification('İşlem sırasında bir hata oluştu', 'error');
            console.error(error);
        }
    });

    // Yardımcı fonksiyonlar
    function displayProductImage(imageUrl) {
        selectedImage.src = imageUrl;
        selectedImage.style.display = 'block';
        productPlaceholder.style.display = 'none';
        updateTryOnButton();
    }

    function updateTryOnButton() {
        const hasProductImage = selectedImage.style.display === 'block';
        const hasUserImage = userImage.style.display === 'block';
        tryOnBtn.disabled = !(hasProductImage && hasUserImage);
    }
});

// Yardımcı fonksiyonlar
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function getBase64FromUrl(url) {
    try {
        if (url.startsWith('data:')) {
            return url;
        }
        const response = await fetch(url);
        const blob = await response.blob();
        return await fileToBase64(blob);
    } catch (error) {
        console.error('Base64 dönüşüm hatası:', error);
        throw error;
    }
}

function showLoading() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">İşleniyor...</div>
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}