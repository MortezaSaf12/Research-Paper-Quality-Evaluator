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
    
    // Add event listener to the PDF download button
    document.getElementById('download-pdf-button').addEventListener('click', function() {
      generatePDF('Paper Comparison Results', evaluation);
    });
    
    // Add event listener to the Excel download button
    document.getElementById('download-excel-button').addEventListener('click', function() {
      generateExcel('Paper Comparison Results', evaluation);
    });
    
    // Show the container and scroll to it
    resultContainer.style.display = 'block';
    resultContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // Generate Excel file from evaluation data
  function generateExcel(title, content) {
    // Create a loading indicator
    const loadingIndicator = document.createElement('span');
    loadingIndicator.className = 'excel-loading';
    loadingIndicator.textContent = ' Generating Excel...';
    document.getElementById('download-excel-button').appendChild(loadingIndicator);

    setTimeout(() => {
      try {
        const findings = extractKeyFindings(content);
        
        if (findings.length === 0) {
          throw new Error('No key findings could be extracted from the evaluation');
        }
        
        // Create CSV content
        let csvContent = "Key Finding Number,Evidence Level,Methodology Quality,Source\n";
        
        findings.forEach(finding => {
          // Format for CSV, escaping quotes and ensuring fields with commas are quoted
          const formatCSVField = (field) => {
            if (!field) return '';
            const fieldStr = String(field).replace(/"/g, '""');
            return fieldStr.includes(',') ? `"${fieldStr}"` : fieldStr;
          };
          
          const row = [
            formatCSVField(finding.number),
            formatCSVField(finding.evidenceLevel),
            formatCSVField(finding.methodologyQuality),
            formatCSVField(finding.source)
          ];
          
          csvContent += row.join(',') + '\n';
        });
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = `${title.replace(/\s+/g, '_')}_${Date.now()}.csv`;
        
        // Create link and trigger download
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
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

  // Extract key findings from the evaluation text
  function extractKeyFindings(text) {
    const findings = [];
    const findingRegex = /###\s*Key\s*Finding\s*#?(\d+|\w+)/gi;
    
    // Find all key findings sections
    const findingMatches = Array.from(text.matchAll(findingRegex));
    
    findingMatches.forEach((match, index) => {
      const startIndex = match.index;
      const endIndex = (index < findingMatches.length - 1) ? findingMatches[index + 1].index : text.length;
      const findingText = text.substring(startIndex, endIndex);
      
      // Extract key finding number
      const numberMatch = findingText.match(/###\s*Key\s*Finding\s*#?(\d+|\w+)/i);
      const number = numberMatch ? numberMatch[1] : index + 1;
      
      // Extract evidence level
      const evidenceLevelMatch = findingText.match(/evidence\s*level\s*:?\s*([1-6])/i);
      const evidenceLevel = evidenceLevelMatch ? evidenceLevelMatch[1] : '';
      
      // Extract methodology quality
      const methodologyMatch = findingText.match(/methodology\s*quality\s*:?\s*([^*\n]+)/i);
      const methodologyQuality = methodologyMatch ? methodologyMatch[1].trim() : '';
      
      // Extract source
      const sourceMatch = findingText.match(/source\s*:?\s*([^*\n]+)/i);
      const source = sourceMatch ? sourceMatch[1].trim() : '';
      
      findings.push({
        number,
        evidenceLevel,
        methodologyQuality,
        source
      });
    });
    
    // If no key findings found with the header format, try alternative parsing
    if (findings.length === 0) {
      // Look for sections that mention "Key Finding" or "Finding" in any format
      const alternativeFindingRegex = /\b(key\s*finding|finding)\b.*?(\d+|\w+)/gi;
      const altMatches = Array.from(text.matchAll(alternativeFindingRegex));
      
      if (altMatches.length > 0) {
        // Process each potential finding
        altMatches.forEach((match, index) => {
          const paragraphStart = text.lastIndexOf('\n\n', match.index) + 2;
          const paragraphEnd = text.indexOf('\n\n', match.index);
          const paragraphText = text.substring(
            paragraphStart >= 0 ? paragraphStart : 0, 
            paragraphEnd >= 0 ? paragraphEnd : text.length
          );
          
          // Extract best-effort data
          const number = match[2] || (index + 1);
          
          // Look for evidence level mentions
          const evidenceLevelMatch = paragraphText.match(/\b(evidence|level)\b.*?([1-6])/i);
          const evidenceLevel = evidenceLevelMatch ? evidenceLevelMatch[2] : '';
          
          // Look for methodology mentions
          const methodologyMatch = paragraphText.match(/\b(methodology|method|quality)\b.*?:?\s*([^*\n.]+)/i);
          const methodologyQuality = methodologyMatch ? methodologyMatch[2].trim() : '';
          
          // Look for source mentions
          const sourceMatch = paragraphText.match(/\b(source|from|paper|title)\b.*?:?\s*([^*\n.]+)/i);
          const source = sourceMatch ? sourceMatch[2].trim() : '';
          
          findings.push({
            number,
            evidenceLevel,
            methodologyQuality,
            source
          });
        });
      }
    }
    
    return findings;
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