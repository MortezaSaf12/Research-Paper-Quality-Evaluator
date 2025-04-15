const { GoogleGenerativeAI } = require("@google/generative-ai");

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async evaluatePaper(file) {
    try {
      // Convert file to proper format for Gemini API
      const fileData = await this.fileToGenerativePart(file);
      
      // Reads guidelines.txt
      const fs = require('fs');
      const path = require('path');
      const guidelinesPath = path.join(__dirname, '../guidelines.txt');
      const guidelines = fs.readFileSync(guidelinesPath, 'utf8');
      
  //prompt to gemini
      const prompt = `
You are an academic research paper evaluator with expertise in evaluating scientific methodology and evidence quality. Your task is to evaluate the attached research paper comprehensively using the evaluation framework detailed below.

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${guidelines}

## EVALUATION INSTRUCTIONS
Use the guideline to:
1. Determine the type of study (e.g., experimental, observational, qualitative, systematic review, etc.).
2. Use the appropriate flowchart and algorithm to assign an **Evidence Level** from 1 to 6.
3. Justify your classification by referencing the relevant criteria from the guideline.

Then, provide a structured evaluation including:

### 1. Study Type and Evidence Level
- Identify the study design.
- Assign an evidence level (1-6) and explain why it was assigned.
- Reference key criteria used from the guideline.

### 2. Methodological Assessment
- Evaluate whether the study design is appropriate for its research question.
- Check for protection against bias: randomization, blinding, and group allocation.
- Note if the methodology meets the standards for being "well-conducted."

### 3. Quantitative or Qualitative Nature
- Specify whether the paper uses quantitative, qualitative, or mixed methods.
- Mention sources of data and how they were analyzed.

### 4. Strengths and Limitations
- Highlight major strengths of the research design.
- Point out any significant weaknesses or risks of bias.
- Consider sample size, clarity of research methods, and analytical rigor.

### 5. Overall Evaluation
- Provide a quality score from 1 to 10 with reasoning.
- Comment on the trustworthiness and relevance of the findings.
- Suggest improvements or clarifications if needed.
- State how applicable the findings are in practice.

Please format your response clearly using headings and bullet points. Refer to specific sections of the uploaded research paper wherever applicable.
`;
;
  
      const parts = [
        { text: prompt },
        fileData
      ];
  
      // Generate content with the model
      const result = await this.model.generateContent({ contents: [{ role: "user", parts }] });
      const response = result.response;
      
      return {
        evaluation: response.text(),
        success: true
      };
    } catch (error) {
      console.error("Gemini evaluation error:", error);
      return {
        success: false,
        error: error.message || "Error evaluating paper with Gemini"
      };
    }
  }

  async fileToGenerativePart(file) {
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(file.path);
    
    // Convert to base64
    const base64Data = fileBuffer.toString('base64');
    
    // Create file part for Gemini
    return {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf"
      }
    };
  }
}

module.exports = new GeminiService();