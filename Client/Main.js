const dropArea = document.getElementById('drop-area');
const errorMessage = document.getElementById('error-message');
const fileInput = document.getElementById('fileElem');
const selectButton = document.querySelector('.button');
const removeButton = document.getElementById('removeButton');

// All scenarios when it comes to inputting the file via dragging on the "border"
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

// Main: Update UI and send file to server
function handleFiles(files) {
  errorMessage.textContent = "";
  const file = files[0];

  // Validate PDF files
  if (file && file.type !== 'application/pdf') {
    errorMessage.textContent = "Invalid file type. Please upload a PDF.";
    return;
  }

  if (file) {
    // Show file name and display remove button
    selectButton.textContent = file.name;
    removeButton.style.display = "inline-block";
    console.log("Accepted file:", file.name);
    uploadFile(file);
  }
}

function uploadFile(file) {
  const formData = new FormData();
  formData.append('pdf', file);

  fetch('/api/pdf/upload', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      console.log('Upload response:', data);
      return fetch('/api/pdf/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: data.fileId })
      });
    })
    .then(res => res.json())
    .then(evalResult => {
      console.log('Evaluation result:', evalResult);
    })
    .catch(err => console.error(err));
}

// Remove logic
removeButton.addEventListener('click', function() {
  fileInput.value = "";
  selectButton.textContent = "Select PDF File";
  errorMessage.textContent = "";
  removeButton.style.display = "none";
  console.log("File removed.");
});
