const dropArea = document.getElementById('drop-area');
const errorMessage = document.getElementById('error-message');
const fileInput = document.getElementById('fileElem');
const selectButton = document.querySelector('.button');
const removeButton = document.getElementById('removeButton');
const selectedFilesDiv = document.getElementById('selected-files');
const actionButtons = document.querySelector('.action-buttons');
const evaluateButton = document.getElementById('evaluate-button');


// Create elements for showing results
const resultContainer = document.createElement('div');
resultContainer.id = 'result-container';
resultContainer.className = 'result-container';
resultContainer.style.display = 'none'; // Hide by default
document.querySelector('.container').appendChild(resultContainer);


// Loading spinner
const loadingSpinner = document.createElement('div');
loadingSpinner.className = 'spinner';
loadingSpinner.innerHTML = '<div class="loader"></div><p>Evaluating papers with GPT-4o-mini...</p>';
document.querySelector('.container').appendChild(loadingSpinner);
loadingSpinner.style.display = 'none';


// Store selected files
let selectedFiles = [];


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


// Main: Process selected files
function handleFiles(files) {
  errorMessage.textContent = "";
 
  // Validate files are PDFs
  const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');
 
  if (validFiles.length === 0) {
    errorMessage.textContent = "Please select PDF files only.";
    return;
  }
 
  if (files.length !== validFiles.length) {
    errorMessage.textContent = "Some files were rejected. Only PDF files are accepted.";
  }
 
  // Add only valid files, i.e pdf files and none other
  selectedFiles = [...selectedFiles, ...validFiles];
  updateFileList();
 
  // Show button if we got file
  if (selectedFiles.length > 0) {
    removeButton.style.display = "inline-block";
    selectedFilesDiv.style.display = "block";
    actionButtons.style.display = "flex";
    selectButton.textContent = "Add More Files";
  }
}


// Updates the file lists on which one are uploaded
function updateFileList() {
  selectedFilesDiv.innerHTML = "";
 
  if (selectedFiles.length === 0) {
    selectedFilesDiv.style.display = "none";
    actionButtons.style.display = "none";
    removeButton.style.display = "none";
    selectButton.textContent = "Select PDF Files";
    return;
  }
 
  const filesList = document.createElement('ul');
  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('li');
    fileItem.innerHTML = `
      <span class="file-name">${file.name}</span>
      <span class="file-size">(${formatFileSize(file.size)})</span>
      <button class="remove-file-btn" data-index="${index}">✕</button>
    `;
    filesList.appendChild(fileItem);
  });
 
  selectedFilesDiv.appendChild(filesList);
 
  // remove button
  document.querySelectorAll('.remove-file-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      selectedFiles.splice(index, 1);
      updateFileList();
    });
  });
}


function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}


// Remove all files
removeButton.addEventListener('click', function() {
  fileInput.value = "";
  selectedFiles = [];
  updateFileList();
  resultContainer.innerHTML = "";
  resultContainer.style.display = 'none'; // Hide the result container
  errorMessage.textContent = "";
});


// button click scenarios
evaluateButton.addEventListener('click', function() {
  if (selectedFiles.length === 0) {
    errorMessage.textContent = "Please select at least one PDF file.";
    return;
  }
 
  // Hide any previous results
  resultContainer.style.display = 'none';
 
  if (selectedFiles.length === 1) {
    // one file
    uploadSingleFile(selectedFiles[0]);
  } else {
    // multiple files
    uploadMultipleFiles(selectedFiles);
  }
});


function uploadSingleFile(file) {
  const formData = new FormData();
  formData.append('pdf', file);


  // Show loading spinner, hide any previous results
  loadingSpinner.style.display = 'flex';
  resultContainer.style.display = 'none';
 
  fetch('/api/pdf/upload', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
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
     
      if (!evalResult.success) {
        throw new Error(evalResult.error || 'Evaluation failed');
      }
      displayEvaluation(evalResult.evaluation);
    })
    .catch(err => {
      loadingSpinner.style.display = 'none';
      console.error(err);
      errorMessage.textContent = err.message || "An error occurred during processing";
    });
}


function uploadMultipleFiles(files) {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('pdfs', file);
  });


  // Show loading spinner, hide any previous results
  loadingSpinner.style.display = 'flex';
  resultContainer.style.display = 'none';
  resultContainer.innerHTML = "";
 
  fetch('/api/pdf/upload-multiple', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        throw new Error(data.error || 'File upload failed');
      }
     
      return fetch('/api/pdf/evaluate-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: data.fileIds })
      });
    })
    .then(res => res.json())
    .then(evalResult => {
      loadingSpinner.style.display = 'none';
     
      if (!evalResult.success) {
        throw new Error(evalResult.error || 'Comparison failed');
      }
      displayComparison(evalResult.evaluation);
    })
    .catch(err => {
      loadingSpinner.style.display = 'none';
      console.error(err);
      errorMessage.textContent = err.message || "An error occurred during processing";
    });
}


// Update the displayEvaluation function to include download buttons
function displayEvaluation(evaluation) {
  // First, make sure we have content to display
  if (!evaluation || evaluation.trim() === '') {
    resultContainer.style.display = 'none';
    return;
  }
 
  // Store the evaluation for use in Excel export
  resultContainer.dataset.evaluation = evaluation;
 
  // Then prepare and display the content
  resultContainer.innerHTML = `
    <h2>Paper Evaluation Results</h2>
    <div class="evaluation-content">
      ${formatEvaluation(evaluation)}
    </div>
    <div class="download-container">
      <button id="download-pdf-button" class="button download-button">
        <span class="download-icon">⬇️</span> Download as PDF
      </button>
      <button id="download-excel-button" class="button download-excel-button">
        <span class="download-icon">📊</span> Download as Excel
      </button>
    </div>
  `;
 
  // Add event listener to the PDF download button
  document.getElementById('download-pdf-button').addEventListener('click', function() {
    generatePDF('Paper Evaluation Results', evaluation);
  });
 
  // Add event listener to the Excel download button
  document.getElementById('download-excel-button').addEventListener('click', function() {
    generateExcel('Paper Evaluation Results', evaluation);
  });
 
  // Show the container and scroll to it
  resultContainer.style.display = 'block';
  resultContainer.scrollIntoView({ behavior: 'smooth' });
}


// Update the displayComparison function to include download buttons
function displayComparison(evaluation) {
  // First, make sure we have content to display
  if (!evaluation || evaluation.trim() === '') {
    resultContainer.style.display = 'none';
    return;
  }
 
  // Store the evaluation for use in Excel export
  resultContainer.dataset.evaluation = evaluation;
 
  // Then prepare and display the content
  resultContainer.innerHTML = `
    <h2>Paper Comparison Results</h2>
    <div class="evaluation-content">
      ${formatEvaluation(evaluation)}
    </div>
    <div class="download-container">
      <button id="download-pdf-button" class="button download-button">
        <span class="download-icon">⬇️</span> Download as PDF
      </button>
      <button id="download-excel-button" class="button download-excel-button">
        <span class="download-icon">📊</span> Download as Excel
      </button>
    </div>
  `;
 
 
  document.getElementById('download-pdf-button').addEventListener('click', function() {
    generatePDF('Paper Comparison Results', evaluation);
  });
 


  document.getElementById('download-excel-button').addEventListener('click', function() {
    generateExcel('Paper Comparison Results', evaluation);
  });
 

  resultContainer.style.display = 'block';
  resultContainer.scrollIntoView({ behavior: 'smooth' });
}


// Updated function for generating Excel without the "Full Evaluation" tab
// Updated function for generating Excel without the "Importance" column
function generateExcel(title, content) {
const loadingIndicator = document.createElement('span');
loadingIndicator.className = 'excel-loading';
loadingIndicator.textContent = ' Generating Excel...';
document.getElementById('download-excel-button').appendChild(loadingIndicator);

setTimeout(() => {
  try {
    // Extract findings with improved extraction
    const findings = extractKeyFindings(content);
    
    if (findings.length === 0) {
      throw new Error('No key findings could be extracted from the evaluation');
    }
    
    // Create new workbook
    const wb = XLSX.utils.book_new();
    
    // Create main worksheet data
    const mainWsData = [
      ['Research Paper Evaluation Results', '', '', '', ''],  // Removed one column
      ['Generated on:', new Date().toLocaleDateString(), '', '', ''],  // Removed one column
      ['', '', '', '', ''],  // Removed one column
      ['Finding Number', 'Criteria', 'Value', 'Evidence Level', 'Methodology Quality']  // Removed "Importance"
    ];
    
    // Renumber findings sequentially for consistency
    findings.forEach((finding, index) => {
      mainWsData.push([
        `Finding #${index + 1}`, // Sequential numbering
        finding.criteria,
        finding.value,
        finding.evidenceLevel,
        finding.methodologyQuality
        // Removed finding.importance
      ]);
      
      // Add source if available
      if (finding.source && finding.source !== 'Not specified') {
        mainWsData.push(['Source:', finding.source, '', '', '']);  // Removed one column
        mainWsData.push(['', '', '', '', '']);  // Removed one column
      } else {
        mainWsData.push(['', '', '', '', '']);  // Removed one column (blank row between findings)
      }
    });
    
    // Create worksheet
    const mainWs = XLSX.utils.aoa_to_sheet(mainWsData);
    
    // Set column widths
    const wscols = [
      {wch: 15},  // Finding number column
      {wch: 40},  // Criteria
      {wch: 40},  // Value
      {wch: 20},  // Evidence Level
      {wch: 20}   // Methodology Quality
      // Removed Importance column
    ];
    mainWs['!cols'] = wscols;
    
    // Row formatting
    if(!mainWs['!rows']) mainWs['!rows'] = [];
    mainWs['!rows'][0] = { hpt: 30 }; // taller row
    
    // Header formatting
    ['A4', 'B4', 'C4', 'D4', 'E4'].forEach(cell => {  // Removed 'F4'
      if(!mainWs[cell]) mainWs[cell] = {};
      mainWs[cell].s = { font: { bold: true } };
    });
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, mainWs, "Key Findings");
    
    // Generate filename
    const filename = `${title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
    
    // Write file and trigger download
    XLSX.writeFile(wb, filename);
    
    // Remove loading indicator
    loadingIndicator.remove();
  } catch (error) {
    console.error('Error generating Excel:', error);
    loadingIndicator.textContent = ' Failed to generate Excel';
    loadingIndicator.style.color = '#dc3545';
    
    setTimeout(() => {
      loadingIndicator.remove();
    }, 3000);
  }
}, 100);
}

// Improved function to extract key findings with better handling of finding numbers and field extraction
function extractKeyFindings(text) {
const findings = [];
let lastEndIndex = 0;

// First try to find distinctly marked key findings using structured headers
const findingHeaderRegex = /(?:###\s*|^|\n)(?:Key\s*Finding|Finding)\s*#?(\d+|\w+)|(?:^|\n)(\d+)\.\s+(?:Key\s*Finding|Finding)/gi;

const findingMatches = Array.from(text.matchAll(findingHeaderRegex));

if (findingMatches.length > 0) {
  // Process matches with clear "Key Finding" headers
  findingMatches.forEach((match, index) => {
    const startIndex = match.index;
    const endIndex = (index < findingMatches.length - 1) ? findingMatches[index + 1].index : text.length;
    lastEndIndex = endIndex;
    
    const findingText = text.substring(startIndex, endIndex);
    processFindingText(findingText, index, findings);
  });
} else {
  // If no clear "Key Finding" headers, try to identify other structured sections
  // Look for sections with bold titles or numbered points
  const sectionRegex = /(?:\*\*|^|\n)(?:(\d+)\.|\*\*([^*\n:]+):\*\*|\*\*([^*\n]+)\*\*(?=\s*\n))/gi;
  const sectionMatches = Array.from(text.matchAll(sectionRegex));
  
  if (sectionMatches.length > 0) {
    sectionMatches.forEach((match, index) => {
      const startIndex = match.index;
      const endIndex = (index < sectionMatches.length - 1) ? sectionMatches[index + 1].index : text.length;
      
      const sectionText = text.substring(startIndex, endIndex);
      processFindingText(sectionText, index, findings);
    });
  } else {
    // Last resort: Split by double newlines and try to extract info
    const paragraphs = text.split(/\n\s*\n/);
    paragraphs.forEach((para, index) => {
      if (para.trim().length > 50) {  // Only consider substantial paragraphs
        processFindingText(para, index, findings);
      }
    });
  }
}

// If still no findings, create a generic one from the full text
if (findings.length === 0 && text.trim().length > 0) {
  findings.push({
    number: 1,
    criteria: "General assessment",
    value: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
    evidenceLevel: extractPattern(text, /evidence\s*level\s*:?\s*([^.,;\n]+)/i, "Not available"),
    methodologyQuality: extractPattern(text, /methodology\s*quality\s*:?\s*([^.,;\n]+)/i, "Not available"),
    importance: extractPattern(text, /importance\s*:?\s*([^.,;\n]+)/i, "High"),
    source: "Document analysis"
  });
}

return findings;
}

// Helper function for extracting content with improved accuracy
function processFindingText(text, index, findings) {
// Clean up text first - replace multiple spaces, normalize newlines
const cleanText = text.replace(/\s+/g, ' ').trim();

// Extract common patterns with fallbacks
const criteriaValue = extractCriteria(text);
const valueContent = extractValue(text);
const evidenceLevel = extractEvidenceLevel(text);
const methodologyQuality = extractMethodologyQuality(text);
const importanceValue = extractImportance(text);
const sourceValue = extractSource(text);

findings.push({
  number: index + 1,
  criteria: criteriaValue || "Key finding",
  value: valueContent || text.substring(0, 150).trim(),
  evidenceLevel: evidenceLevel || "Moderate",
  methodologyQuality: methodologyQuality || "Standard",
  importance: importanceValue || "Medium",
  source: sourceValue || "Paper analysis"
});
}

// Improved extraction functions with multiple pattern matching and text analysis
function extractCriteria(text) {
// Try patterns in sequence
const patterns = [
  /[*•-]?\s*\*?\*?Criteria\s*:?\s*\*?\*?([^*\n]+?)(?=\n[*•-]|\*\*|$)/i,
  /[*•-]?\s*\*?\*?(?:Subject|Topic|Focus)\s*:?\s*\*?\*?([^*\n]+?)(?=\n[*•-]|\*\*|$)/i,
  /The\s+(?:study|paper|research|analysis)\s+(?:examines|investigates|explores|analyzes|focuses\s+on)\s+([^.]+)/i
];

for (const pattern of patterns) {
  const match = text.match(pattern);
  if (match && match[1] && match[1].trim().length > 0) {
    return match[1].trim();
  }
}

// If no pattern matches, look for the first sentence that might describe criteria
const sentences = text.split(/[.!?]+/);
for (const sentence of sentences) {
  if (sentence.toLowerCase().includes('study') || 
      sentence.toLowerCase().includes('research') || 
      sentence.toLowerCase().includes('paper') || 
      sentence.toLowerCase().includes('finding')) {
    return sentence.trim();
  }
}

return null;
}

function extractValue(text) {
// Try patterns in sequence
const patterns = [
  /[*•-]?\s*\*?\*?Value\s*:?\s*\*?\*?([^*\n]+?)(?=\n[*•-]|\*\*|$)/i,
  /[*•-]?\s*\*?\*?(?:Result|Outcome|Finding)\s*:?\s*\*?\*?([^*\n]+?)(?=\n[*•-]|\*\*|$)/i,
  /(?:found|showed|demonstrated|revealed|indicated|suggests|concludes)\s+that\s+([^.]+)/i
];

for (const pattern of patterns) {
  const match = text.match(pattern);
  if (match && match[1] && match[1].trim().length > 0) {
    return match[1].trim();
  }
}

// If no matches from patterns, check for sentences with key indicators
const sentences = text.split(/[.!?]+/);
for (const sentence of sentences) {
  if (sentence.toLowerCase().includes('result') || 
      sentence.toLowerCase().includes('showed') || 
      sentence.toLowerCase().includes('found') ||
      sentence.toLowerCase().includes('demonstrated')) {
    return sentence.trim();
  }
}

return null;
}

function extractEvidenceLevel(text) {
return extractPattern(text, 
  /[*•-]?\s*\*?\*?Evidence\s*(?:Level|Quality|Strength)\s*:?\s*\*?\*?([^*\n]+?)(?=\n[*•-]|\*\*|$)/i, 
  null);
}

function extractMethodologyQuality(text) {
return extractPattern(text, 
  /[*•-]?\s*\*?\*?Methodology\s*(?:Quality|Rigor|Approach)\s*:?\s*\*?\*?([^*\n]+?)(?=\n[*•-]|\*\*|$)/i, 
  null);
}

function extractImportance(text) {
return extractPattern(text, 
  /[*•-]?\s*\*?\*?(?:Importance|Significance|Relevance)\s*:?\s*\*?\*?([^*\n]+?)(?=\n[*•-]|\*\*|$)/i, 
  null);
}

function extractSource(text) {
return extractPattern(text, 
  /[*•-]?\s*\*?\*?(?:Source|Reference|Citation)\s*:?\s*\*?\*?([^*\n]+?)(?=\n[*•-]|\*\*|$)/i, 
  null);
}

// Generic pattern extraction helper
function extractPattern(text, pattern, defaultValue) {
const match = text.match(pattern);
if (match && match[1] && match[1].trim().length > 0) {
  return match[1].trim();
}
return defaultValue;
}


// The PDF generation function
function generatePDF(title, content) {
  // Create a loading indicator
  const loadingIndicator = document.createElement('span');
  loadingIndicator.className = 'pdf-loading';
  loadingIndicator.textContent = ' Generating PDF...';
  document.getElementById('download-pdf-button').appendChild(loadingIndicator);




  setTimeout(() => {
    try {
 
      const { jsPDF } = window.jspdf;
     

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });


      // fontsize
      pdf.setFontSize(12);
     
      // font type + title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, 20, 20);
     
      // Current date
      const currentDate = new Date().toLocaleDateString();
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Generated: ${currentDate}`, 20, 30);
     
      // Format the content for PDF
      const contentDiv = document.querySelector('.evaluation-content').innerHTML;
     
      // Create a temporary div to convert HTML to plain text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = contentDiv;
     
      // Extract structured content
      let formattedContent = formatContentForPDF(tempDiv);
     
      // Start y position for content
      let yPos = 40;
      const lineHeight = 7;
      const margin = 20;
      const pageWidth = 210;
      const contentWidth = pageWidth - (margin * 2);
     
      // Add content sections with formatting
      formattedContent.forEach(section => {
        // Check if we need to add a new page
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
       
        if (section.type === 'heading') {
          // Add some spacing before headings
          if (yPos > 40) yPos += 5;
         
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text(section.text, margin, yPos);
          yPos += lineHeight;
        }
        else if (section.type === 'subheading') {
          // Add pacing before subheadings
          yPos += 3;
         
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(section.text, margin, yPos);
          yPos += lineHeight;
        }
        else if (section.type === 'paragraph') {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          const splitText = pdf.splitTextToSize(section.text, contentWidth);
         
          // Check if we need to add a new page
          if (yPos + (splitText.length * (lineHeight - 2)) > 280) {
            pdf.addPage();
            yPos = 20;
          }
         
          pdf.text(splitText, margin, yPos);
          yPos += (splitText.length * (lineHeight - 2)) + 2;
        }
        else if (section.type === 'listItem') {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          const itemText = `• ${section.text}`;
          const splitText = pdf.splitTextToSize(itemText, contentWidth - 5);
         
          //do we need to add a new page to the pdf?
          if (yPos + (splitText.length * (lineHeight - 2)) > 280) {
            pdf.addPage();
            yPos = 20;
          }
         
          pdf.text(splitText, margin + 5, yPos);
          yPos += (splitText.length * (lineHeight - 2)) + 1;
        }
      });
     
      // Filename from title + date
      const filename = `${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
     
      // Save pdf
      pdf.save(filename);
     
      // remove loading symbol
      loadingIndicator.remove();
    } catch (error) {
      console.error('Error generating PDF:', error);
      loadingIndicator.textContent = ' Failed to generate PDF';
      loadingIndicator.style.color = '#dc3545';
     
   
      setTimeout(() => {
        loadingIndicator.remove();
      }, 3000);
    }
  }, 100);
}


function formatContentForPDF(contentElement) {
  const result = [];
 
  // Process node and its children
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {


        if (node.parentElement && (node.parentElement.tagName === 'LI' ||
            (node.parentElement.parentElement && node.parentElement.parentElement.tagName === 'LI'))) {
          result.push({ type: 'listItem', text });
        } else {
          result.push({ type: 'paragraph', text });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {


      if (node.tagName === 'H3') {
        result.push({ type: 'heading', text: node.textContent.trim() });
      } else if (node.tagName === 'STRONG' && node.textContent.includes('Key Finding')) {
        result.push({ type: 'subheading', text: node.textContent.trim() });
      } else if (node.tagName === 'STRONG' && node.parentElement.tagName !== 'LI') {
        result.push({ type: 'subheading', text: node.textContent.trim() });
      } else if (['UL', 'OL'].includes(node.tagName)) {


        Array.from(node.childNodes).forEach(processNode);
      } else if (node.tagName === 'LI') {
        result.push({ type: 'listItem', text: node.textContent.trim() });
      } else if (node.tagName === 'P' && node.textContent.trim()) {
        result.push({ type: 'paragraph', text: node.textContent.trim() });
      } else {


        Array.from(node.childNodes).forEach(processNode);
      }
    }
  }
 


  Array.from(contentElement.childNodes).forEach(processNode);
 
  return result;
}


function formatEvaluation(text) {


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
