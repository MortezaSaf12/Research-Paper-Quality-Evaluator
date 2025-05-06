const fs = require('fs');
const path = require('path');
const OpenAI = require("openai");
const pdf = require('pdf-parse');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.SECRET_OPENAI_KEY,
    });
    this.model = "gpt-4o-mini";
    this.guidelinesPath = path.join(__dirname, '../guidelines.txt');
    this.guidelines = fs.readFileSync(this.guidelinesPath, 'utf8');
  }

  async evaluatePaper(file) {
    try {
      // Extract text content from the file
      const fileContent = await this.extractFileContent(file);
      
      const prompt = `
You are an academic research paper evaluator with expertise in scientific methodology and evidence quality. Your task is to extract and evaluate key findings from the attached research paper using the evaluation framework detailed below.

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${this.guidelines}

## EVALUATION INSTRUCTIONS
1. Extract 3-5 main key findings from the research paper.
2. For each key finding, provide the following structure:

### Key Finding #[number]
- **Criteria**: What this finding is about (e.g., a specific intervention, observation, or relationship)
- **Value**: The specific result or outcome that was discovered
- **Evidence Level**: Assign an evidence level (1-6) based on the guidelines and justify this classification
- **Source**: The title of the paper where this finding is from
- **Methodology Quality**: Brief assessment of how the finding was determined (sample size, controls, etc.)
- **Importance**: Why this finding matters in the context of the research field

### Format Example (Do not use tables):
Key Finding #1
- Criteria: [Subject of finding]
- Value: [Specific result/outcome]
- Evidence Level: [1-6] - [Brief justification]
- Source: [Paper title]
- Methodology Quality: [Brief assessment]
- Importance: [Why this matters]

Apply the appropriate evidence level classification from the guidelines.txt for each finding to determine it

## PAPER CONTENT:
${fileContent}
`;
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are an academic research paper evaluator focused on extracting and evaluating key findings according to evidence quality guidelines."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });
      
      return {
        evaluation: response.choices[0].message.content,
        success: true
      };
    } catch (error) {
      console.error("OpenAI evaluation error:", error);
      return {
        success: false,
        error: error.message || "Error evaluating paper with OpenAI"
      };
    }
  }

  async extractFileContent(file) {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      // Handle PDF files
      if (fileExtension === '.pdf') {
        console.log(`Processing PDF file: ${file.originalname}`);
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdf(dataBuffer);
        return pdfData.text;
      }
     //handle other files
      else if (['.txt', '.md', '.rtf'].includes(fileExtension)) {
        console.log(`Processing text file: ${file.originalname}`);
        return fs.readFileSync(file.path, 'utf8');
      }
  
      else {
        console.log(`Unsupported file type: ${fileExtension}, attempting to process as text`);
        return fs.readFileSync(file.path, 'utf8');
      }
    } catch (error) {
      console.error(`Error extracting content from file: ${file.originalname}`, error);
      throw new Error(`Failed to extract content from file: ${file.originalname}`);
    }
  }

  // comparing multiple papers
  async comparePapers(files) {
    try {
    
      const paperContents = await Promise.all(files.map(async (file) => {
        const content = await this.extractFileContent(file);
        return {
          filename: file.originalname,
          content: content
        };
      }));
      
      // Multiple paper comparison prompt
      const comparisonPrompt = `
You are an expert academic evaluator tasked with comparing key findings across multiple research papers. Based on the content provided below:

1. Extract 3-5 key findings from each paper
2. For each key finding, provide:
   - Criteria: What this finding is about
   - Value: The specific result or outcome discovered
   - Evidence Level: (1-6) based on the guidelines with justification
   - Source: Title of the paper
   - Methodology Quality: Brief assessment of methods used
   - Importance: Significance of this finding

3. Then create a consolidated list of the most important findings across all papers, ranked by evidence quality (using the 1-6 scale from the guidelines)

4. Provide a brief synthesis of how these findings relate to each other and what overall conclusions can be drawn

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${this.guidelines}

## PAPERS:
${paperContents.map((paper, index) => `
PAPER ${index + 1}: ${paper.filename}
${paper.content.substring(0, 8000)}... [content truncated for token limit]
`).join('\n---\n')} 

Present your findings in a clear, structured format without using tables. Number each key finding and organize them by paper first, then provide the consolidated ranking.
`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are an expert academic evaluator extracting and comparing key findings across multiple research papers according to evidence quality guidelines."
          },
          {
            role: "user",
            content: comparisonPrompt
          }
        ]
      });
      
      return {
        evaluation: response.choices[0].message.content,
        success: true
      };
      
    } catch (error) {
      console.error("OpenAI comparison error:", error);
      return {
        success: false,
        error: error.message || "Error comparing papers with OpenAI"
      };
    }
  }
}

module.exports = OpenAIService;