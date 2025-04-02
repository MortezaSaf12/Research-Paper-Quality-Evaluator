const fs = require('fs');
const pdfParse = require('pdf-parse');

exports.uploadPDF = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);

    console.log("Extracted text:", pdfData.text);

    res.json({ fileName: file.originalname, text: pdfData.text });
  } catch (error) {
    console.error("Error parsing PDF:", error);
    res.status(500).json({ error: "PDF parsing failed" });
  }
};
