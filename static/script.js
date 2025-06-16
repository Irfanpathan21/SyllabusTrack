// Set up PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// Base URL for your Flask API
const API_BASE_URL = ''; // Empty string means current origin, useful for local development

// UI Element References
const authSection = document.getElementById('auth-section');
const mainAppSection = document.getElementById('main-app-section');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const rememberMeCheckbox = document.getElementById('remember-me');
const loginButton = document.getElementById('login-button');
const showSignupButton = document.getElementById('show-signup-button');
const loginErrorMessage = document.getElementById('login-error-message');

const signupUsernameInput = document.getElementById('signup-username');
const signupPasswordInput = document.getElementById('signup-password');
const signupButton = document.getElementById('signup-button');
const showLoginButton = document.getElementById('show-login-button');
const signupErrorMessage = document.getElementById('signup-error-message');

const loggedInUsernameDisplay = document.getElementById('logged-in-username');
const logoutButton = document.getElementById('logout-button');

const fileUploadSection = document.getElementById('file-upload-section');
const dragDropArea = document.getElementById('drag-drop-area');
const syllabusFileInput = document.getElementById('syllabus-file-input');
const browseFilesButton = document.getElementById('browse-files-button');
const processingFeedback = document.getElementById('processing-feedback');
const processingMessage = document.getElementById('processing-message');
const fileErrorMessage = document.getElementById('file-error-message');

const syllabusContentSection = document.getElementById('syllabus-content-section');
const overallProgressBar = document.getElementById('overall-progress-bar');
const overallProgressPercentage = document.getElementById('overall-progress-percentage');
const subjectsContainer = document.getElementById('subjects-container');
const summarizeSyllabusButton = document.getElementById('summarize-syllabus-button');
const summarizationFeedback = document.getElementById('summarization-feedback');
const overallSummaryDisplay = document.getElementById('overall-summary-display');
const overallSyllabusSummaryText = document.getElementById('overall-syllabus-summary-text');
const subjectSummariesDisplay = document.getElementById('subject-summaries-display');

let loggedInUser = null;
let parsedSyllabusData = null; // Stores the current user's parsed syllabus
let summarizedSyllabusData = null; // Stores the current user's summarized syllabus

// --- Authentication System ---

const showLogin = () => {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginErrorMessage.classList.add('hidden');
    signupErrorMessage.classList.add('hidden');
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
};

const showSignup = () => {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    loginErrorMessage.classList.add('hidden');
    signupErrorMessage.classList.add('hidden');
    signupUsernameInput.value = '';
    signupPasswordInput.value = '';
};

const login = async () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!username || !password) {
        loginErrorMessage.textContent = 'Please enter both username and password.';
        loginErrorMessage.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password, remember_me: rememberMeCheckbox.checked }),
        });
        const data = await response.json();

        if (response.ok) {
            loggedInUser = username;
            loggedInUsernameDisplay.textContent = username;
            showMainApp();
            await loadUserData(); // Load parsed syllabus and progress for the logged-in user
            loginErrorMessage.classList.add('hidden');
        } else {
            loginErrorMessage.textContent = data.message || 'Login failed.';
            loginErrorMessage.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Login error:', error);
        loginErrorMessage.textContent = 'An error occurred during login. Please try again.';
        loginErrorMessage.classList.remove('hidden');
    }
};

const signup = async () => {
    const username = signupUsernameInput.value.trim();
    const password = signupPasswordInput.value.trim();

    if (!username || !password) {
        signupErrorMessage.textContent = 'Please enter both username and password.';
        signupErrorMessage.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();

        if (response.ok) {
            signupErrorMessage.textContent = 'Registration successful! Please log in.';
            signupErrorMessage.classList.remove('hidden');
            signupErrorMessage.classList.remove('text-red-500');
            signupErrorMessage.classList.add('text-green-500');
            showLogin();
        } else {
            signupErrorMessage.textContent = data.message || 'Signup failed.';
            signupErrorMessage.classList.remove('hidden');
            signupErrorMessage.classList.remove('text-green-500');
            signupErrorMessage.classList.add('text-red-500');
        }
    } catch (error) {
        console.error('Signup error:', error);
        signupErrorMessage.textContent = 'An error occurred during signup. Please try again.';
        signupErrorMessage.classList.remove('hidden');
        signupErrorMessage.classList.remove('text-green-500');
        signupErrorMessage.classList.add('text-red-500');
    }
};

const logout = async () => {
    try {
        await fetch(`${API_BASE_URL}/api/logout`, { method: 'POST' });
    } catch (error) {
        console.error('Error logging out on backend:', error);
    }
    loggedInUser = null;
    parsedSyllabusData = null; // Clear current user's parsed syllabus
    summarizedSyllabusData = null; // Clear current user's summarized syllabus
    subjectsContainer.innerHTML = ''; // Clear displayed syllabus content
    overallSummaryDisplay.classList.add('hidden');
    overallSyllabusSummaryText.textContent = '';
    subjectSummariesDisplay.innerHTML = '';
    subjectSummariesDisplay.classList.add('hidden');
    fileUploadSection.classList.remove('hidden'); // Show file upload area again
    syllabusContentSection.classList.add('hidden');
    showAuthSection();
};

const showMainApp = () => {
    authSection.classList.add('hidden');
    mainAppSection.classList.remove('hidden');
};

const showAuthSection = () => {
    mainAppSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    showLogin(); // Default to login form
};

// --- Data Loading/Saving from Backend ---

const loadUserData = async () => {
    if (!loggedInUser) {
        return;
    }
    try {
        // Fetch parsed syllabus
        const syllabusResponse = await fetch(`${API_BASE_URL}/api/syllabus/${loggedInUser}`);
        if (syllabusResponse.ok) {
            parsedSyllabusData = await syllabusResponse.json();
            fileUploadSection.classList.add('hidden');
            syllabusContentSection.classList.remove('hidden');
            renderSyllabus(parsedSyllabusData);
        } else {
            // No syllabus uploaded yet, keep file upload section visible
            fileUploadSection.classList.remove('hidden');
            syllabusContentSection.classList.add('hidden');
            parsedSyllabusData = null;
        }

        // Fetch summarized syllabus
        const summaryResponse = await fetch(`${API_BASE_URL}/api/summary/${loggedInUser}`);
        if (summaryResponse.ok) {
            summarizedSyllabusData = await summaryResponse.json();
            if (summarizedSyllabusData) {
                overallSummaryDisplay.classList.remove('hidden');
                overallSyllabusSummaryText.textContent = summarizedSyllabusData.overallSyllabusSummary || 'No overall summary available.';
                renderSubjectSummaries(summarizedSyllabusData.subjectsDetailedSummaries || []);
            }
        } else {
            overallSummaryDisplay.classList.add('hidden');
            subjectSummariesDisplay.classList.add('hidden');
            summarizedSyllabusData = null;
        }

        // Fetch progress data
        const progressResponse = await fetch(`${API_BASE_URL}/api/progress/${loggedInUser}`);
        if (progressResponse.ok) {
            userProgress = await progressResponse.json();
            calculateOverallProgress(); // Recalculate with fetched progress
        } else {
            userProgress = {}; // No progress saved yet
        }

    } catch (error) {
        console.error('Error loading user data:', error);
        // Fallback to clear local state if backend fetch fails
        parsedSyllabusData = null;
        summarizedSyllabusData = null;
        userProgress = {};
        fileUploadSection.classList.remove('hidden');
        syllabusContentSection.classList.add('hidden');
        overallSummaryDisplay.classList.add('hidden');
        subjectSummariesDisplay.classList.add('hidden');
    }
};

const saveProgress = async () => {
    if (!loggedInUser) return;
    try {
        await fetch(`${API_BASE_URL}/api/progress/${loggedInUser}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userProgress),
        });
    } catch (error) {
        console.error('Error saving progress:', error);
    }
};

// --- File Handling and Text Extraction ---

const extractTextFromFile = async (file) => {
    fileErrorMessage.classList.add('hidden');
    processingFeedback.classList.remove('hidden');
    processingMessage.textContent = 'Extracting text...';

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            const fileType = file.name.split('.').pop().toLowerCase();

            try {
                let textContent = '';
                if (fileType === 'pdf') {
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    const numPages = pdf.numPages;
                    for (let i = 1; i <= numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContentResult = await page.getTextContent();
                        textContent += textContentResult.items.map(item => item.str).join(' ') + '\n';
                    }
                } else if (fileType === 'docx') {
                    const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    textContent = result.value;
                } else if (fileType === 'txt') {
                    textContent = new TextDecoder('utf-8').decode(arrayBuffer);
                } else {
                    reject('Unsupported file type.');
                    return;
                }
                resolve(textContent);
            } catch (error) {
                console.error('Error extracting text:', error);
                reject('Failed to extract text from file. Please ensure it\'s a valid PDF, DOCX, or TXT.');
            }
        };
        reader.onerror = (e) => reject('Error reading file: ' + e.target.error);
        reader.readAsArrayBuffer(file);
    });
};

// --- UI Rendering and Progress Tracking ---

const renderSyllabus = (data) => {
    subjectsContainer.innerHTML = '';
    if (!data || !data.subjects || data.subjects.length === 0) {
        subjectsContainer.innerHTML = '<p class="text-gray-600">No syllabus content to display. Please upload a file.</p>';
        return;
    }

    data.subjects.forEach(subject => {
        const subjectElement = document.createElement('div');
        subjectElement.className = 'subject-block bg-white border border-gray-200 rounded-lg shadow-sm mb-4';
        subjectElement.innerHTML = `
            <div class="bg-gray-50 p-4 rounded-t-lg">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-xl font-semibold text-gray-800">${subject.subjectName}</h3>
                    <span id="subject-progress-percentage-${cleanId(subject.subjectName)}" class="text-lg font-bold text-blue-600">0%</span>
                </div>
                <div class="progress-bar-container">
                    <div id="subject-progress-bar-${cleanId(subject.subjectName)}" class="progress-bar" style="width: 0%;"></div>
                </div>
            </div>
            <div class="p-4">
                <div class="units-container space-y-3">
                </div>
            </div>
        `;
        subjectsContainer.appendChild(subjectElement);

        const unitsContainer = subjectElement.querySelector('.units-container');
        subject.units.forEach(unit => {
            const unitElement = document.createElement('div');
            const unitId = `unit-${cleanId(subject.subjectName)}-${cleanId(unit.unitName)}`;
            unitElement.className = 'unit-item border-b border-gray-100 last:border-b-0';
            unitElement.innerHTML = `
                <div class="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-gray-50 transition duration-150 ease-in-out" data-unit-id="${unitId}">
                    <span class="font-medium text-gray-700">${unit.unitName}</span>
                    <i class="fas fa-chevron-down text-gray-500 transform transition-transform duration-300"></i>
                </div>
                <div id="${unitId}-topics" class="topics-list pl-6 pr-3 py-2 hidden">
                </div>
            `;
            unitsContainer.appendChild(unitElement);

            const unitHeader = unitElement.querySelector(`[data-unit-id="${unitId}"]`);
            const topicsList = unitElement.querySelector(`#${unitId}-topics`);
            const chevronIcon = unitHeader.querySelector('.fa-chevron-down');

            unitHeader.addEventListener('click', () => {
                topicsList.classList.toggle('hidden');
                chevronIcon.classList.toggle('rotate-180');
            });

            if (unit.topics && unit.topics.length > 0) {
                unit.topics.forEach(topic => {
                    const topicElement = document.createElement('div');
                    const topicKey = `t_${cleanId(subject.subjectName)}_${cleanId(unit.unitName)}_${cleanId(topic)}`;
                    const isChecked = userProgress[topicKey] || false;

                    topicElement.className = 'flex items-start mb-2 last:mb-0';
                    topicElement.innerHTML = `
                        <span class="custom-checkbox ${isChecked ? 'checked' : ''}" data-topic-key="${topicKey}"></span>
                        <span class="ml-3 text-gray-700">${topic}</span>
                    `;
                    topicsList.appendChild(topicElement);

                    topicElement.querySelector('.custom-checkbox').addEventListener('click', async (e) => {
                        const clickedTick = e.target;
                        const currentKey = clickedTick.dataset.topicKey;
                        userProgress[currentKey] = !userProgress[currentKey]; // Toggle state
                        clickedTick.classList.toggle('checked', userProgress[currentKey]);
                        await saveProgress();
                        calculateOverallProgress(); // Recalculate progress on topic change
                    });
                });
            } else {
                const noTopics = document.createElement('p');
                noTopics.className = 'text-gray-500 text-sm italic';
                noTopics.textContent = 'No topics found for this unit.';
                topicsList.appendChild(noTopics);
            }
        });
    });
    calculateOverallProgress(); // Initial calculation after rendering
};

const calculateOverallProgress = () => {
    if (!parsedSyllabusData || !parsedSyllabusData.subjects) {
        overallProgressBar.style.width = '0%';
        overallProgressPercentage.textContent = '0%';
        return;
    }

    let totalTopics = 0;
    let completedTopics = 0;
    const subjectTopicCounts = {}; // { subjectName: { total: X, completed: Y } }

    parsedSyllabusData.subjects.forEach(subject => {
        const subjectName = cleanId(subject.subjectName);
        subjectTopicCounts[subjectName] = { total: 0, completed: 0 };

        subject.units.forEach(unit => {
            unit.topics.forEach(topic => {
                totalTopics++;
                subjectTopicCounts[subjectName].total++;
                const topicKey = `t_${cleanId(subject.subjectName)}_${cleanId(unit.unitName)}_${cleanId(topic)}`;
                if (userProgress[topicKey]) {
                    completedTopics++;
                    subjectTopicCounts[subjectName].completed++;
                }
            });
        });
    });

    const overallPercentage = totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100);
    overallProgressBar.style.width = `${overallPercentage}%`;
    overallProgressPercentage.textContent = `${overallPercentage}%`;

    // Update individual subject progress bars
    for (const subjectName in subjectTopicCounts) {
        const { total, completed } = subjectTopicCounts[subjectName];
        const subjectPercentage = total === 0 ? 0 : Math.round((completed / total) * 100);

        const subjectProgressBar = document.getElementById(`subject-progress-bar-${subjectName}`);
        const subjectProgressPercentage = document.getElementById(`subject-progress-percentage-${subjectName}`);

        if (subjectProgressBar && subjectProgressPercentage) {
            subjectProgressBar.style.width = `${subjectPercentage}%`;
            subjectProgressPercentage.textContent = `${subjectPercentage}%`;
        }
    }
};

const renderSubjectSummaries = (summaries) => {
    subjectSummariesDisplay.innerHTML = '';
    if (summaries.length === 0) {
        subjectSummariesDisplay.classList.add('hidden');
        return;
    }
    subjectSummariesDisplay.classList.remove('hidden');

    summaries.forEach(s => {
        const subjectSummaryHtml = `
            <div class="bg-blue-50 p-4 rounded-lg shadow-sm mb-4">
                <h4 class="text-lg font-semibold mb-2 text-gray-800">${s.subjectName} Summary:</h4>
                <p class="text-gray-700">${s.subjectSummary}</p>
                ${s.topicSummaries && s.topicSummaries.length > 0 ? `
                    <h5 class="font-medium text-gray-700 mt-3 mb-1">Topic Summaries:</h5>
                    <ul class="list-disc pl-5 space-y-1 text-gray-600">
                        ${s.topicSummaries.map(t => `<li><strong>${t.topicName}:</strong> ${t.summary}</li>`).join('')}
                    </ul>
                ` : '<p class="text-gray-500 italic text-sm mt-2">No topic summaries available for this subject.</p>'}
            </div>
        `;
        subjectSummariesDisplay.insertAdjacentHTML('beforeend', subjectSummaryHtml);
    });
};

// Helper to create clean IDs for elements
const cleanId = (text) => {
    return text.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
};

// --- Event Listeners ---

// Authentication
showSignupButton.addEventListener('click', showSignup);
showLoginButton.addEventListener('click', showLogin);
loginButton.addEventListener('click', login);
signupButton.addEventListener('click', signup);
logoutButton.addEventListener('click', logout);

// Allow pressing Enter for login/signup
loginUsernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginButton.click(); });
loginPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginButton.click(); });
signupUsernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') signupButton.click(); });
signupPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') signupButton.click(); });


// File Upload
dragDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragDropArea.classList.add('hover');
});

dragDropArea.addEventListener('dragleave', () => {
    dragDropArea.classList.remove('hover');
});

dragDropArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDropArea.classList.remove('hover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        await handleFileUpload(files[0]);
    }
});

browseFilesButton.addEventListener('click', () => syllabusFileInput.click());

syllabusFileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        await handleFileUpload(files[0]);
    }
});

const handleFileUpload = async (file) => {
    fileErrorMessage.classList.add('hidden');
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
        fileErrorMessage.textContent = 'Invalid file type. Please upload a PDF, DOCX, or TXT file.';
        fileErrorMessage.classList.remove('hidden');
        return;
    }

    try {
        const textContent = await extractTextFromFile(file);
        processingMessage.textContent = 'Sending to backend for parsing...';

        const formData = new FormData();
        formData.append('username', loggedInUser);
        formData.append('syllabus_text', textContent);
        formData.append('filename', file.name); // Send filename for context if needed

        const response = await fetch(`${API_BASE_URL}/api/parse_syllabus`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            parsedSyllabusData = data.parsed_data; // Assuming backend sends parsed_data
            fileUploadSection.classList.add('hidden'); // Hide upload section
            syllabusContentSection.classList.remove('hidden'); // Show content section
            renderSyllabus(parsedSyllabusData); // Render the parsed syllabus
            processingFeedback.classList.add('hidden');
        } else {
            fileErrorMessage.textContent = data.message || 'Error parsing syllabus with AI.';
            fileErrorMessage.classList.remove('hidden');
            processingFeedback.classList.add('hidden');
        }
    } catch (error) {
        console.error('File processing error:', error);
        fileErrorMessage.textContent = error.message || 'Error processing file. Please try again.';
        fileErrorMessage.classList.remove('hidden');
        processingFeedback.classList.add('hidden');
    } finally {
        syllabusFileInput.value = ''; // Clear file input
    }
};

// Summarization
summarizeSyllabusButton.addEventListener('click', async () => {
    if (!parsedSyllabusData) {
        fileErrorMessage.textContent = 'Please upload and parse a syllabus first.';
        fileErrorMessage.classList.remove('hidden');
        return;
    }
    try {
        summarizationFeedback.classList.remove('hidden');

        const response = await fetch(`${API_BASE_URL}/api/summarize_syllabus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: loggedInUser,
                parsed_syllabus: parsedSyllabusData
            }),
        });

        const data = await response.json();

        if (response.ok) {
            summarizedSyllabusData = data.summarized_data;
            overallSummaryDisplay.classList.remove('hidden');
            overallSyllabusSummaryText.textContent = summarizedSyllabusData.overallSyllabusSummary;
            renderSubjectSummaries(summarizedSyllabusData.subjectsDetailedSummaries);
        } else {
            fileErrorMessage.textContent = data.message || 'Error generating summary. Please try again.';
            fileErrorMessage.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Summarization error:', error);
        fileErrorMessage.textContent = error.message || 'Error generating summary. Please try again.';
        fileErrorMessage.classList.remove('hidden');
    } finally {
        summarizationFeedback.classList.add('hidden');
    }
});

// --- Initialization ---

const init = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/check_auth`);
        const data = await response.json();
        if (response.ok && data.username) {
            loggedInUser = data.username;
            loggedInUsernameDisplay.textContent = loggedInUser;
            showMainApp();
            await loadUserData();
        } else {
            showAuthSection();
        }
    } catch (error) {
        console.error('Error checking authentication status:', error);
        showAuthSection(); // Default to auth section if backend is unreachable
    }
};

init();