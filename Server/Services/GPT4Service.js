const fs = require('fs');
const path = require('path');
const axios = require('axios');

class GPT4Service {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = "gpt-4o-mini";
    this.apiUrl = "https://api.openai.com/v1/chat/completions";
    this.guidelinesPath = path.join(__dirname, '../guidelines.txt');
    this.guidelines = fs.readFileSync(this.guidelinesPath, 'utf8');
  }

  async evaluatePaper(file) {
    try {
      // Read PDF file as base64
      const fileBuffer = fs.readFileSync(file.path);
      const base64Data = fileBuffer.toString('base64');
      
      const prompt = `
You are an academic research paper evaluator with expertise in evaluating scientific methodology and evidence quality. Your task is to evaluate the attached research paper comprehensively using the evaluation framework detailed below.

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${this.guidelines}

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

The paper content is attached as a PDF.
`;

      // Make API request to OpenAI
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: prompt 
                },
                {
                  type: "file_attachment",
                  file_attachment: {
                    type: "pdf",
                    data: base64Data
                  }
                }
              ]
            }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return {
        evaluation: response.data.choices[0].message.content,
        success: true
      };
    } catch (error) {
      console.error("GPT-4 evaluation error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || "Error evaluating paper with GPT-4"
      };
    }
  }

  async fileToGenerativePart(file) {
    const fileBuffer = fs.readFileSync(file.path);
    
    // Convert to base64
    const base64Data = fileBuffer.toString('base64');
    
    return base64Data;
  }

  // New method to handle comparison between multiple papers
  async comparePapers(files) {
    try {
      // First evaluate each paper individually to get detailed analysis
      console.log(`Evaluating ${files.length} papers individually...`);
      const evaluations = [];
      
      for (const file of files) {
        console.log(`Evaluating paper: ${file.originalname}`);
        // Extract only key information for each paper to avoid token overload
        const summary = await this.extractPaperSummary(file);
        evaluations.push({
          filename: file.originalname,
          summary: summary
        });
      }
      
      // Now compare the papers based on their evaluations
      console.log("Generating comparison between papers...");
      
      const comparisonPrompt = `
You are an expert academic evaluator tasked with comparing multiple research papers. Based on the summaries provided below, create a comprehensive comparison highlighting the strengths and weaknesses of each paper, focusing specifically on:

1. Research methodology (rigor, appropriateness for research question, protection against bias)
2. Evidence level (based on the 1-6 scale from the guidelines)
3. Key findings and their significance
4. Overall quality and trustworthiness of results

For each paper, provide a numerical quality score from 1-10, with clear justification for your rating.

Then create an overall ranking of the papers from highest to lowest quality, with a brief explanation of why each paper earned its position in the ranking.

Present this comparison in a structured format with clear sections for:
- Individual paper assessments (methodology, evidence level, quality score)
- Comparative analysis (strengths/weaknesses across papers)
- Final ranking with justification

Paper summaries:
${evaluations.map((evaluation, index) => `
PAPER ${index + 1}: ${evaluation.filename}
${evaluation.summary}
`).join('\n---\n')}

Based on the guidelines for evaluating research quality, provide your comprehensive comparison and ranking.
`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: "user",
              content: comparisonPrompt
            }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return {
        evaluation: response.data.choices[0].message.content,
        success: true
      };
      
    } catch (error) {
      console.error("GPT-4 comparison error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || "Error comparing papers with GPT-4"
      };
    }
  }

  // Extract key information from a paper to create a concise summary
  async extractPaperSummary(file) {
    try {
      const fileBuffer = fs.readFileSync(file.path);
      const base64Data = fileBuffer.toString('base64');
      
      const extractPrompt = `
Extract the key information from this research paper that would be relevant for evaluating its quality. Focus on:

1. Study design and methodology
2. Data collection methods
3. Sample size and characteristics
4. Key findings and results
5. Statistical methods used (if applicable)
6. Limitations acknowledged by authors

Keep your response concise but comprehensive, highlighting information that would help determine the evidence level (1-6) according to research evaluation guidelines.
`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: extractPrompt
                },
                {
                  type: "file_attachment",
                  file_attachment: {
                    type: "pdf",
                    data: base64Data
                  }
                }
              ]
            }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error("Error extracting paper summary:", error.response?.data || error.message);
      throw new Error("Failed to extract paper summary");
    }
  }
  
  // Pairwise comparison method for more objective ranking
  async comparePapersPairwise(files) {
    try {
      // First evaluate each paper individually
      console.log(`Evaluating ${files.length} papers individually...`);
      const evaluations = [];
      
      for (const file of files) {
        console.log(`Evaluating paper: ${file.originalname}`);
        const evalResult = await this.evaluatePaper(file);
        if (!evalResult.success) {
          throw new Error(`Failed to evaluate paper: ${file.originalname}`);
        }
        evaluations.push({
          filename: file.originalname,
          evaluation: evalResult.evaluation
        });
      }
      
      // Create all possible pairs for comparison
      const pairs = [];
      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          pairs.push([i, j]);
        }
      }
      
      // Compare each pair
      const pairResults = [];
      for (const [i, j] of pairs) {
        const result = await this.compareTwoPapers(
          evaluations[i].filename, evaluations[i].evaluation,
          evaluations[j].filename, evaluations[j].evaluation
        );
        pairResults.push({
          pair: [i, j],
          winner: result.winner, // 0 for first paper, 1 for second paper, 0.5 for tie
          reasoning: result.reasoning
        });
      }
      
      // Count wins for ranking
      const scores = Array(files.length).fill(0);
      pairResults.forEach(result => {
        if (result.winner === 0) scores[result.pair[0]] += 1;
        else if (result.winner === 1) scores[result.pair[1]] += 1;
        else {
          // Tie - half point to each
          scores[result.pair[0]] += 0.5;
          scores[result.pair[1]] += 0.5;
        }
      });
      
      // Create final ranking
      const ranking = files.map((file, index) => ({
        filename: file.originalname,
        score: scores[index],
        evaluation: evaluations[index].evaluation
      })).sort((a, b) => b.score - a.score);
      
      // Format final comparison result
      const comparisonResult = this.formatPairwiseComparison(ranking, pairResults, files);
      
      return {
        evaluation: comparisonResult,
        success: true
      };
      
    } catch (error) {
      console.error("GPT-4 pairwise comparison error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || "Error comparing papers with GPT-4"
      };
    }
  }
  
  async compareTwoPapers(filename1, evaluation1, filename2, evaluation2) {
    try {
      const prompt = `
You are an expert in research methodology tasked with determining which of two research papers has higher methodological quality. Compare the following two papers based strictly on their methodology, evidence level, and overall research quality.

PAPER 1: ${filename1}
${evaluation1}

PAPER 2: ${filename2}
${evaluation2}

Based ONLY on research methodology and evidence quality (not on the topic or findings), determine which paper has higher methodological quality. Consider:
1. Evidence level (1-6, with 1 being highest)
2. Study design rigor
3. Protection against bias
4. Quality of data collection and analysis
5. Sample size and selection
6. Methodological limitations

Respond with:
1. Which paper has higher methodological quality (specify either "PAPER 1" or "PAPER 2", or "TIE" if they are equivalent)
2. A brief justification explaining your decision (100-200 words)
`;
  
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      const responseText = response.data.choices[0].message.content;
      
      // Parse the winner from the response
      let winner;
      if (responseText.toLowerCase().includes("paper 1") && !responseText.toLowerCase().includes("paper 2 has higher")) {
        winner = 0;
      } else if (responseText.toLowerCase().includes("paper 2") && !responseText.toLowerCase().includes("paper 1 has higher")) {
        winner = 1;
      } else {
        winner = 0.5; // Tie
      }
      
      return {
        winner: winner,
        reasoning: responseText
      };
    } catch (error) {
      console.error("Error comparing two papers:", error.response?.data || error.message);
      throw new Error("Failed to compare papers");
    }
  }
  
  formatPairwiseComparison(ranking, pairResults, files) {
    // Format the overall ranking
    let result = `# Research Paper Quality Comparison Results\n\n`;
    result += `## Overall Ranking (Highest to Lowest Quality)\n\n`;
    
    ranking.forEach((paper, index) => {
      result += `${index + 1}. **${paper.filename}** (Score: ${paper.score}/${pairResults.length})\n`;
    });
    
    // Add individual paper evaluations (abbreviated)
    result += `\n## Individual Paper Assessments\n\n`;
    ranking.forEach(paper => {
      // Extract just the key information from the full evaluation
      const keyInfo = paper.evaluation.split('\n').filter(line => 
        line.includes('Evidence Level') || 
        line.includes('Quality Score') || 
        line.includes('Study Type')
      ).join('\n');
      
      result += `### ${paper.filename}\n${keyInfo}\n\n`;
    });
    
    // Add pairwise comparison details
    result += `\n## Pairwise Comparison Details\n\n`;
    pairResults.forEach(result => {
      const paper1 = files[result.pair[0]].originalname;
      const paper2 = files[result.pair[1]].originalname;
      let winnerText;
      
      if (result.winner === 0) winnerText = `**${paper1}** was determined to have higher quality than ${paper2}`;
      else if (result.winner === 1) winnerText = `**${paper2}** was determined to have higher quality than ${paper1}`;
      else winnerText = `**${paper1}** and **${paper2}** were determined to be of equal quality`;
      
      result += `### ${paper1} vs. ${paper2}\n${winnerText}\n\n`;
    });
    
    // Add visualization recommendation
    result += `\n## Key Findings Visualization\n\nA radar chart or bar chart comparing the key methodological aspects of these papers would be beneficial for visualization.\n`;
    
    return result;
  }
}

module.exports = GPT4Service;