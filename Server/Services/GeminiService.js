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
      
      // PRISMA EVLUATION GUIDELINES
      const prompt = `
        You are an academic research evaluator. Please evaluate the attached research paper according to PRISMA (Preferred Reporting Items for Systematic Reviews and Meta-Analyses) guidelines. 
        
        Provide a comprehensive evaluation covering:
        1. Title and Abstract - Clear identification as systematic review/meta-analysis
        2. Introduction - Clear rationale and objectives
        3. Methods - Protocol and registration, eligibility criteria, information sources, search strategy
        4. Results - Study selection, data extraction, risk of bias assessment
        5. Discussion - Summary of evidence, limitations, conclusions
        
        For each section, provide:
        - Assessment of compliance with PRISMA guidelines
        - Strengths and weaknesses
        - Recommendations for improvement
        
        Finally, provide an overall quality score (1-10) and summary assessment.
      `;

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