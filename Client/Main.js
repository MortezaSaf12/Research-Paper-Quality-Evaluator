const dropArea = document.getElementById('drop-area');
const errorMessage = document.getElementById('error-message');
const fileInput = document.getElementById('fileElem');
const selectButton = document.querySelector('.button');
const removeButton = document.getElementById('removeButton');

// Create elements for showing results
const resultContainer = document.createElement('div');
resultContainer.id = 'result-container';
resultContainer.className = 'result-container';
document.querySelector('.container').appendChild(resultContainer);

// Loading spinner
const loadingSpinner = document.createElement('div');
loadingSpinner.className = 'spinner';
loadingSpinner.innerHTML = '<div class="loader"></div><p>Evaluating paper with Gemini AI...</p>';
document.querySelector('.container').appendChild(loadingSpinner);
loadingSpinner.style.display = 'none';

// All scenarios of dragging on the "border"
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Highlight drop area when file is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
});
['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
});

// Handle file drop
dropArea.addEventListener('drop', handleDrop, false);
function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

// Main: Send file to server
function handleFiles(files) {
  errorMessage.textContent = "";
  resultContainer.innerHTML = "";
  const file = files[0];

  // Validate PDF files
  if (file && file.type !== 'application/pdf') {
    errorMessage.textContent = "Invalid file type. Please upload a PDF.";
    return;
  }

  if (file) {
    // Shows file name, displays remove button
    selectButton.textContent = file.name;
    removeButton.style.display = "inline-block";
    console.log("Accepted file:", file.name);
    uploadFile(file);
  }
}

function uploadFile(file) {
  const formData = new FormData();
  formData.append('pdf', file);

  loadingSpinner.style.display = 'flex';
  
  fetch('/api/pdf/upload', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      console.log('Upload response:', data);
      if (!data.success) {
        throw new Error(data.error || 'File upload failed');
      }
      
      return fetch('/api/pdf/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: data.fileId })
      });
    })
    .then(res => res.json())
    .then(evalResult => {
      loadingSpinner.style.display = 'none';
      
      console.log('Evaluation result:', evalResult);
      if (!evalResult.success) {
        throw new Error(evalResult.error || 'Evaluation failed');
      }
        displayEvaluation(evalResult.evaluation);
    })
    .catch(err => {
      // Hide loading spinner
      loadingSpinner.style.display = 'none';
      console.error(err);
      errorMessage.textContent = err.message || "An error occurred during processing";
    });
}

function displayEvaluation(evaluation) {
  resultContainer.innerHTML = `
    <h2>PRISMA Evaluation Results</h2>
    <div class="evaluation-content">
      ${formatEvaluation(evaluation)}
    </div>
  `;
  resultContainer.scrollIntoView({ behavior: 'smooth' });
}

function formatEvaluation(text) {
  // Convert markdown-like text from Gemini to HTML
  return text
    .replace(/\n\n/g, '</p><p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^#+ (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^\d+\. (.*?)$/gm, '<li>$1</li>')
    .replace(/<li>(.*?)<\/li>/g, '<ol><li>$1</li></ol>')
    .replace(/<\/ol><ol>/g, '')
    .replace(/^- (.*?)$/gm, '<li>$1</li>')
    .replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>')
    .replace(/<\/ul><ul>/g, '');
}

// Remove logic
removeButton.addEventListener('click', function() {
  fileInput.value = "";
  selectButton.textContent = "Select PDF File";
  errorMessage.textContent = "";
  removeButton.style.display = "none";
  resultContainer.innerHTML = "";
  console.log("File removed.");
});