const fs = require('fs');
const path = require('path');
const uuid = require('uuid');
const GeminiService = require('../Services/GeminiService'); // Connecting to our LLM 

//FOR NOW: Store uploaded files temporarily with IDs
const uploadedFiles = {};

exports.uploadPDF = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileId = uuid.v4(); // Unique ID for each file
    uploadedFiles[fileId] = file;
    
    res.json({ 
      fileId: fileId,
      fileName: file.originalname,
      success: true
    });
  } catch (error) {
    console.error("Error handling file upload:", error);
    res.status(500).json({ error: "File upload failed", success: false });
  }
};

exports.evaluatePaper = async (req, res) => {
  try {
    const { fileId } = req.body;
    
    if (!fileId || !uploadedFiles[fileId]) {
      return res.status(400).json({ error: "Invalid file ID", success: false });
    }
    
    const file = uploadedFiles[fileId];
    
    // Sending to AI for evaluation
    const evaluationResult = await GeminiService.evaluatePaper(file);
    
    if (!evaluationResult.success) {
      return res.status(500).json({ 
        error: evaluationResult.error,
        success: false
      });
    }
    
    // Clean up file after processing
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    delete uploadedFiles[fileId];
    
    res.json({
      evaluation: evaluationResult.evaluation,
      success: true
    });
    
  } catch (error) {
    console.error("Error evaluating paper:", error);
    res.status(500).json({ error: "Evaluation failed", success: false });
  }
};