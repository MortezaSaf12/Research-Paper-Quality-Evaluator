const fs = require('fs');
const path = require('path');
const uuid = require('uuid');
const OpenAIService = require('../Services/OpenAIService');
const openaiService = new OpenAIService();

const uploadedFiles = {};

// Upload single PDF
exports.uploadPDF = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded", success: false });
    }

    const fileId = uuid.v4();
    uploadedFiles[fileId] = file;

    res.json({
      fileId,
      fileName: file.originalname,
      success: true
    });
  } catch (error) {
    console.error("Error handling file upload:", error);
    res.status(500).json({ error: "File upload failed", success: false });
  }
};

// Evaluate a single uploaded PDF
exports.evaluatePaper = async (req, res) => {
  try {
    const { fileId } = req.body;

    if (!fileId || !uploadedFiles[fileId]) {
      return res.status(400).json({ error: "Invalid file ID", success: false });
    }

    const file = uploadedFiles[fileId];
    const evaluationResult = await openaiService.evaluatePaper(file);

    if (!evaluationResult.success) {
      return res.status(500).json({
        error: evaluationResult.error,
        success: false
      });
    }

    // Clean up
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

// Upload multiple PDFs
exports.uploadMultiplePDFs = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded", success: false });
    }

    const fileIds = [];

    for (const file of files) {
      const fileId = uuid.v4();
      uploadedFiles[fileId] = file;
      fileIds.push(fileId);
    }

    res.json({
      fileIds,
      fileCount: files.length,
      success: true
    });

  } catch (error) {
    console.error("Error handling multiple file uploads:", error);
    res.status(500).json({ error: "File upload failed", success: false });
  }
};

// Evaluate and compare multiple uploaded PDFs
exports.evaluateAndComparePapers = async (req, res) => {
  try {
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: "Invalid file IDs", success: false });
    }

    const files = [];
    for (const fileId of fileIds) {
      const file = uploadedFiles[fileId];
      if (!file) {
        return res.status(400).json({ error: `Invalid file ID: ${fileId}`, success: false });
      }
      files.push(file);
    }

    let comparisonResult;
    if (files.length === 1) {
      comparisonResult = await openaiService.evaluatePaper(files[0]);
    } else {
      comparisonResult = await openaiService.comparePapers(files);
    }

    if (!comparisonResult.success) {
      return res.status(500).json({
        error: comparisonResult.error,
        success: false
      });
    }

    // Clean up all processed files
    for (const fileId of fileIds) {
      const file = uploadedFiles[fileId];
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      delete uploadedFiles[fileId];
    }

    res.json({
      evaluation: comparisonResult.evaluation,
      success: true
    });

  } catch (error) {
    console.error("Error comparing papers:", error);
    res.status(500).json({ error: "Comparison failed", success: false });
  }
};