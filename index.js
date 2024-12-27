document.addEventListener('DOMContentLoaded', function() {
    // ... önceki DOM element seçimleri aynı ...

    // API Constants
    const API_BASE_URL = 'https://api.fashn.ai/v1';
    const API_KEY = 'YOUR_SECRET_API_KEY'; // Bizim API anahtarımız

    // Deneme sayısı kontrolü
    let currentTrials = 0;
    let isLoggedIn = false;

    // Deneme sayısını storage'dan yükle
    async function loadTrialCount() {
        const storage = await chrome.storage.local.get(['trialCount', 'isLoggedIn', 'loggedInTrialCount']);
        currentTrials = storage.trialCount || 0;
        isLoggedIn = storage.isLoggedIn || false;
        
        // Bilgilendirme mesajını güncelle
        updateTrialInfo();
    }

    // Deneme bilgisini güncelle
    function updateTrialInfo() {
        const notification = document.querySelector('.notification');
        if (isLoggedIn) {
            const remainingTrials = 3 - currentTrials;
            if (remainingTrials > 0) {
                notification.textContent = `${remainingTrials} ücretsiz deneme hakkınız kaldı`;
                notification.style.backgroundColor = '#FFF3BF';
                tryOnBtn.disabled = false;
            } else {
                notification.textContent = 'Deneme hakkınız bitti. Daha fazlası için kontör satın alın.';
                notification.style.backgroundColor = '#FFE4E4';
                tryOnBtn.disabled = true;
            }
        } else {
            const remainingTrials = 3 - currentTrials;
            if (remainingTrials > 0) {
                notification.textContent = `${remainingTrials} deneme hakkınız kaldı, daha fazlası için giriş yapın`;
                notification.style.backgroundColor = '#FFF3BF';
                tryOnBtn.disabled = false;
            } else {
                notification.textContent = 'Deneme hakkınız bitti. Daha fazlası için giriş yapın.';
                notification.style.backgroundColor = '#FFE4E4';
                tryOnBtn.disabled = true;
            }
        }
    }

    // Deneme sayısını artır ve sakla
    async function incrementTrialCount() {
        currentTrials++;
        await chrome.storage.local.set({ 
            trialCount: currentTrials,
            lastTrialDate: new Date().toISOString()
        });
        updateTrialInfo();
    }

    async function startTryOn(modelImage, garmentImage) {
        try {
            processContainer.classList.remove('hidden');
            tryOnBtn.disabled = true;

            const requestData = {
                model_image: modelImage,
                garment_image: garmentImage,
                category: 'tops',
                nsfw_filter: true,
                mode: 'balanced',
                num_samples: 1
            };

            const runResponse = await fetch(`${API_BASE_URL}/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify(requestData)
            });

            if (!runResponse.ok) {
                const errorData = await runResponse.json();
                throw new Error(errorData.error?.message || 'API yanıt vermedi');
            }

            const runResult = await runResponse.json();
            const predictionId = runResult.id;

            // Durum kontrolü için polling
            const checkStatus = async () => {
                const statusResponse = await fetch(`${API_BASE_URL}/status/${predictionId}`, {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`
                    }
                });

                if (!statusResponse.ok) {
                    throw new Error('Durum kontrolü başarısız oldu');
                }

                const statusResult = await statusResponse.json();

                if (statusResult.status === 'completed') {
                    resultImage.src = statusResult.output[0];
                    resultImage.style.display = 'block';
                    resultPreview.classList.remove('hidden');
                    await incrementTrialCount(); // Başarılı denemeden sonra sayıyı artır
                    return true;
                }

                if (statusResult.status === 'failed') {
                    throw new Error(statusResult.error?.message || 'İşlem başarısız oldu');
                }

                if (['starting', 'in_queue', 'processing'].includes(statusResult.status)) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return checkStatus();
                }
            };

            await checkStatus();

        } catch (error) {
            console.error('API Hatası:', error);
            alert('İşlem sırasında bir hata oluştu: ' + error.message);
        } finally {
            processContainer.classList.add('hidden');
            tryOnBtn.disabled = false;
        }
    }

    // Login butonu
    loginBtn.addEventListener('click', async () => {
        // Kullanıcı giriş yaptığında
        isLoggedIn = true;
        currentTrials = 0; // Giriş yapınca yeni 3 hak
        await chrome.storage.local.set({ 
            isLoggedIn: true,
            trialCount: 0
        });
        updateTrialInfo();
        chrome.tabs.create({ url: 'https://fasheone.com/login' });
    });

    // Try On butonu
    tryOnBtn.addEventListener('click', async function() {
        // Deneme hakkı kontrolü
        if (!isLoggedIn && currentTrials >= 3) {
            alert('Deneme hakkınız bitti. Daha fazlası için giriş yapın.');
            return;
        }
        if (isLoggedIn && currentTrials >= 3) {
            alert('Ücretsiz deneme hakkınız bitti. Daha fazlası için kontör satın alın.');
            return;
        }

        if (productPreview.style.display === 'none') {
            alert('Lütfen önce bir ürün seçin');
            return;
        }

        if (modelPreview.style.display === 'none') {
            alert('Lütfen fotoğrafınızı yükleyin');
            return;
        }

        try {
            const productResponse = await fetch(productPreview.src);
            const productBlob = await productResponse.blob();
            const modelResponse = await fetch(modelPreview.src);
            const modelBlob = await modelResponse.blob();

            const modelBase64 = await imageToBase64(modelBlob);
            const garmentBase64 = await imageToBase64(productBlob);

            await startTryOn(modelBase64, garmentBase64);
        } catch (error) {
            console.error('Resim yükleme hatası:', error);
            alert('Resimler yüklenirken bir hata oluştu');
        }
    });

    // ... diğer fonksiyonlar aynı ...

    // Sayfa yüklendiğinde deneme sayısını yükle
    loadTrialCount();
});