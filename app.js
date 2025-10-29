// Configuration
const SUPABASE_URL = 'https://jmvkahnscnkxjmqvonbu.supabase.co';
const CHAT_URL = `${SUPABASE_URL}/functions/v1/chat`;
const IMAGE_URL = `${SUPABASE_URL}/functions/v1/generate-image`;
const PPT_URL = `${SUPABASE_URL}/functions/v1/generate-ppt`;
const DATA_URL = `${SUPABASE_URL}/functions/v1/analyze-data`;

// State
let chatMessages = [];
let currentAnalysis = null;

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Tab Navigation
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            // Update active button
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active tab content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// LLM Chat
function initLLMChat() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatMessagesContainer = document.getElementById('chat-messages');
    
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        const userMessage = { role: 'user', content: message };
        chatMessages.push(userMessage);
        chatInput.value = '';
        
        renderChatMessages();
        sendBtn.disabled = true;
        
        try {
            const response = await fetch(CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatMessages })
            });
            
            if (!response.ok) throw new Error('Failed to get response');
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let textBuffer = '';
            let assistantContent = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                textBuffer += decoder.decode(value, { stream: true });
                
                let newlineIndex;
                while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
                    let line = textBuffer.slice(0, newlineIndex);
                    textBuffer = textBuffer.slice(newlineIndex + 1);
                    
                    if (line.endsWith('\r')) line = line.slice(0, -1);
                    if (line.startsWith(':') || line.trim() === '') continue;
                    if (!line.startsWith('data: ')) continue;
                    
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') break;
                    
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            assistantContent += content;
                            
                            // Update or add assistant message
                            if (chatMessages[chatMessages.length - 1]?.role === 'assistant') {
                                chatMessages[chatMessages.length - 1].content = assistantContent;
                            } else {
                                chatMessages.push({ role: 'assistant', content: assistantContent });
                            }
                            
                            renderChatMessages();
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            showToast('Failed to send message', 'error');
        } finally {
            sendBtn.disabled = false;
        }
    }
    
    function renderChatMessages() {
        if (chatMessages.length === 0) {
            chatMessagesContainer.innerHTML = '<p class="empty-state">Start a conversation with the AI assistant...</p>';
            return;
        }
        
        chatMessagesContainer.innerHTML = chatMessages.map(msg => `
            <div class="chat-message ${msg.role}">
                <p class="message-role">${msg.role === 'user' ? 'You' : 'AI'}</p>
                <p class="message-content">${msg.content}</p>
            </div>
        `).join('');
        
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    newChatBtn.addEventListener('click', () => {
        chatMessages = [];
        renderChatMessages();
        showToast('Chat cleared');
    });
}

// Image Generator
function initImageGenerator() {
    const promptInput = document.getElementById('image-prompt');
    const generateBtn = document.getElementById('generate-image-btn');
    const downloadBtn = document.getElementById('download-image-btn');
    const newImageBtn = document.getElementById('new-image-btn');
    const imagePreview = document.getElementById('image-preview');
    let currentImageUrl = '';
    
    async function generateImage() {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showToast('Please enter a description', 'error');
            return;
        }
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<svg class="icon-sm loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Generating...';
        
        try {
            const response = await fetch(IMAGE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            
            if (!response.ok) throw new Error('Failed to generate image');
            
            const data = await response.json();
            if (data.imageUrl) {
                currentImageUrl = data.imageUrl;
                imagePreview.innerHTML = `<img src="${currentImageUrl}" alt="Generated">`;
                downloadBtn.classList.remove('hidden');
                showToast('Image generated successfully!');
            }
        } catch (error) {
            console.error('Image generation error:', error);
            showToast('Failed to generate image', 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> Generate Image';
        }
    }
    
    function downloadImage() {
        if (!currentImageUrl) {
            showToast('No image to download', 'error');
            return;
        }
        
        const link = document.createElement('a');
        link.href = currentImageUrl;
        link.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Image downloaded successfully!');
    }
    
    generateBtn.addEventListener('click', generateImage);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') generateImage();
    });
    downloadBtn.addEventListener('click', downloadImage);
    
    newImageBtn.addEventListener('click', () => {
        promptInput.value = '';
        currentImageUrl = '';
        imagePreview.innerHTML = '<svg class="icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><p>Generated image will appear here</p>';
        downloadBtn.classList.add('hidden');
        showToast('Image cleared');
    });
}

// PPT Generator
function initPPTGenerator() {
    const titleInput = document.getElementById('ppt-title');
    const contentInput = document.getElementById('ppt-content');
    const generateBtn = document.getElementById('generate-ppt-btn');
    const downloadBtn = document.getElementById('download-ppt-btn');
    const newPptBtn = document.getElementById('new-ppt-btn');
    const pptPreview = document.getElementById('ppt-preview');
    let currentSlides = [];
    
    async function generatePPT() {
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        
        if (!title || !content) {
            showToast('Please enter both title and content', 'error');
            return;
        }
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<svg class="icon-sm loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Generating...';
        
        try {
            const response = await fetch(PPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            
            if (!response.ok) throw new Error('Failed to generate presentation');
            
            const data = await response.json();
            if (data.slides) {
                currentSlides = data.slides;
                renderSlides();
                downloadBtn.classList.remove('hidden');
                showToast('Presentation generated successfully!');
            }
        } catch (error) {
            console.error('PPT generation error:', error);
            showToast('Failed to generate presentation', 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> Generate PPT';
        }
    }
    
    function renderSlides() {
        if (currentSlides.length === 0) {
            pptPreview.innerHTML = '<p class="empty-state">Presentation preview will appear here</p>';
            return;
        }
        
        pptPreview.innerHTML = currentSlides.map((slide, index) => `
            <div class="slide">
                <h3>Slide ${index + 1}: ${slide.title}</h3>
                <ul>
                    ${slide.points.map(point => `<li>${point}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    }
    
    function downloadPPT() {
        if (currentSlides.length === 0) {
            showToast('No presentation to download', 'error');
            return;
        }
        
        const title = titleInput.value.trim();
        let content = `${title}\n${'='.repeat(title.length)}\n\n`;
        
        currentSlides.forEach((slide, index) => {
            content += `\nSlide ${index + 1}: ${slide.title}\n`;
            content += `${'-'.repeat(slide.title.length + 10)}\n`;
            slide.points.forEach(point => {
                content += `• ${point}\n`;
            });
            content += '\n';
        });
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title.replace(/\s+/g, '-')}-${Date.now()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Presentation downloaded successfully!');
    }
    
    generateBtn.addEventListener('click', generatePPT);
    downloadBtn.addEventListener('click', downloadPPT);
    
    newPptBtn.addEventListener('click', () => {
        titleInput.value = '';
        contentInput.value = '';
        currentSlides = [];
        renderSlides();
        downloadBtn.classList.add('hidden');
        showToast('PPT cleared');
    });
}

// Text-to-Speech (UI Only - No Backend Implementation)
function initTextToSpeech() {
    const newAudioBtn = document.getElementById('new-audio-btn');
    const ttsText = document.getElementById('tts-text');
    
    newAudioBtn.addEventListener('click', () => {
        ttsText.value = '';
        showToast('Audio cleared');
    });
}

// Data Analyzer
function initDataAnalyzer() {
    const fileInput = document.getElementById('data-file-upload');
    const chooseFileBtn = document.getElementById('choose-file-btn');
    const newAnalysisBtn = document.getElementById('new-analysis-btn');
    const analysisResults = document.getElementById('analysis-results');
    const emptyResults = document.getElementById('empty-results');
    const downloadBtn = document.getElementById('download-analysis-btn');
    
    async function analyzeData(file) {
        chooseFileBtn.disabled = true;
        chooseFileBtn.innerHTML = '<svg class="icon-sm loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Analyzing...';
        
        try {
            const fileContent = await file.text();
            
            const response = await fetch(DATA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileContent, fileName: file.name })
            });
            
            if (!response.ok) throw new Error('Failed to analyze data');
            
            const data = await response.json();
            if (data) {
                currentAnalysis = data;
                renderAnalysis();
                showToast('Data analyzed successfully!');
            }
        } catch (error) {
            console.error('Data analysis error:', error);
            showToast('Failed to analyze data', 'error');
        } finally {
            chooseFileBtn.disabled = false;
            chooseFileBtn.innerHTML = '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Choose File';
        }
    }
    
    function renderAnalysis() {
        if (!currentAnalysis) {
            analysisResults.classList.add('hidden');
            emptyResults.classList.remove('hidden');
            return;
        }
        
        analysisResults.classList.remove('hidden');
        emptyResults.classList.add('hidden');
        
        // Render summary
        document.getElementById('data-summary').innerHTML = `
            <p><strong>Total Rows:</strong> ${currentAnalysis.summary.totalRows}</p>
            <p><strong>Columns:</strong> ${currentAnalysis.summary.columns.join(', ')}</p>
        `;
        
        // Render visualizations
        document.getElementById('visualizations-list').innerHTML = currentAnalysis.visualizationSuggestions
            .map(suggestion => `<li>${suggestion}</li>`)
            .join('');
        
        // Render insights
        document.getElementById('insights-list').innerHTML = currentAnalysis.insights
            .map(insight => `<li>${insight}</li>`)
            .join('');
    }
    
    function downloadAnalysis() {
        if (!currentAnalysis) {
            showToast('No analysis to download', 'error');
            return;
        }
        
        const report = {
            generatedAt: new Date().toISOString(),
            summary: currentAnalysis.summary,
            insights: currentAnalysis.insights,
            visualizationSuggestions: currentAnalysis.visualizationSuggestions
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `data-analysis-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Analysis downloaded successfully!');
    }
    
    chooseFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) analyzeData(file);
    });
    downloadBtn.addEventListener('click', downloadAnalysis);
    
    newAnalysisBtn.addEventListener('click', () => {
        currentAnalysis = null;
        fileInput.value = '';
        renderAnalysis();
        showToast('Analysis cleared');
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initLLMChat();
    initImageGenerator();
    initPPTGenerator();
    initTextToSpeech();
    initDataAnalyzer();
});