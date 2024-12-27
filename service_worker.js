// API ve Konfigürasyon
const CONFIG = {
    API: {
        BASE_URL: 'https://api.fashn.ai/v1',
        KEY: 'Bearer fa-uAxCjH5BfAOK-aQo3eMhcDgbXN1GF52CbGioh'
    },
    CATEGORIES: {
        'top': 'tops',
        'bottom': 'bottoms',
        'dress': 'one-pieces'
    }
};

// API işlemleri
class APIService {
    constructor() {
        this.baseUrl = CONFIG.API.BASE_URL;
        this.apiKey = CONFIG.API.KEY;
    }

    async processImages(modelImage, garmentImage, category) {
        try {
            const apiCategory = CONFIG.CATEGORIES[category] || 'one-pieces';
            
            const requestBody = {
                model_image: modelImage,
                garment_image: garmentImage,
                category: apiCategory
            };

            console.log('API Request:', {
                url: `${this.baseUrl}/run`,
                category: apiCategory
            });

            const response = await fetch(`${this.baseUrl}/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.apiKey,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await this.handleResponse(response);
            return data;
        } catch (error) {
            console.error('Process Images Error:', error);
            throw error;
        }
    }

    async checkStatus(jobId) {
        try {
            const response = await fetch(`${this.baseUrl}/status/${jobId}`, {
                headers: {
                    'Authorization': this.apiKey,
                    'Accept': 'application/json'
                }
            });

            const data = await this.handleResponse(response);
            return data;
        } catch (error) {
            console.error('Check Status Error:', error);
            throw error;
        }
    }

    async handleResponse(response) {
        const text = await response.text();
        
        try {
            const data = JSON.parse(text);
            
            if (!response.ok) {
                throw new Error(data.error?.message || `API Error: ${response.status}`);
            }
            
            return data;
        } catch (e) {
            throw new Error(`Failed to parse response: ${text}`);
        }
    }
}

// Servis sınıfı instance'ı
const apiService = new APIService();

// Mesaj yönetimi
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request.type);

    switch (request.type) {
        case 'PROCESS_IMAGE':
            handleProcessImage(request, sendResponse);
            break;

        case 'CHECK_STATUS':
            handleCheckStatus(request, sendResponse);
            break;

        case 'SELECTED_IMAGE':
        case 'OPEN_POPUP':
            handlePopupActions(request, sendResponse);
            break;

        default:
            sendResponse({ success: false, error: 'Unknown message type' });
    }

    return true;
});

// İstek işleyicileri
async function handleProcessImage(request, sendResponse) {
    try {
        if (!request.modelImage || !request.garmentImage) {
            throw new Error('Missing image data');
        }

        const result = await apiService.processImages(
            request.modelImage,
            request.garmentImage,
            request.category
        );

        sendResponse({ success: true, data: result });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleCheckStatus(request, sendResponse) {
    try {
        const result = await apiService.checkStatus(request.jobId);
        sendResponse({ success: true, data: result });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handlePopupActions(request, sendResponse) {
    try {
        // Storage'a resmi kaydet
        if (request.imageUrl) {
            await chrome.storage.local.set({
                selectedImage: request.imageUrl,
                lastSelected: Date.now()
            });
        }

        // Popup'ı aç
        try {
            await chrome.action.openPopup();
        } catch (error) {
            console.warn('Cannot open popup programmatically:', error);
        }

        sendResponse({ success: true });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Kurulum
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            settings: {
                trialCount: {
                    free: 3,
                    premium: 3
                },
                selectedCategory: 'one-pieces'
            }
        });
    }
});