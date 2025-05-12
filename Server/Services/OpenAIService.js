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

    // Initialize queue for paper evaluations
    this.evaluationQueue = [];
    // Store completed items so they can still be fetched after shifting
    this.completedQueue = {};
    this.isProcessingQueue = false;
  }

  /**
   * Evaluate a single research paper and extract key findings
   */
  async evaluatePaper(file, returnConcise = false) {
    try {
      const fileContent = await this.extractFileContent(file);

      const detailedPrompt = `
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
- **Methodology Quality**: Assessment of how the finding was determined (sample size, controls, etc.)
- **Importance**: Why this finding matters in the context of the research field

Apply the appropriate evidence level classification from the guidelines.txt for each finding to determine it

## PAPER CONTENT:
${fileContent}
`;

      const concisePrompt = `
You are an academic research paper evaluator with expertise in scientific methodology and evidence quality. Your task is to extract and summarize key findings from the attached research paper.

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${this.guidelines}

## INSTRUCTIONS
1. Extract 3-5 main key findings from the research paper.
2. For each key finding, provide a summary with:
   - Description of the key finding
   - Evidence level (1-6) based on the guidelines
   - Methodology quality

## PAPER CONTENT:
${fileContent}
`;

      const prompt = returnConcise ? concisePrompt : detailedPrompt;

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
        success: true,
        filename: file.originalname
      };
    } catch (error) {
      console.error("OpenAI evaluation error:", error);
      return {
        success: false,
        error: error.message || "Error evaluating paper with OpenAI",
        filename: file.originalname
      };
    }
  }

  /**
   * Extract content from various file types
   */
  async extractFileContent(file) {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();

      if (fileExtension === '.pdf') {
        console.log(`Processing PDF file: ${file.originalname}`);
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdf(dataBuffer);
        return pdfData.text;
      } else if (['.txt', '.md', '.rtf'].includes(fileExtension)) {
        console.log(`Processing text file: ${file.originalname}`);
        return fs.readFileSync(file.path, 'utf8');
      } else {
        console.log(`Unsupported file type: ${fileExtension}, attempting to process as text`);
        return fs.readFileSync(file.path, 'utf8');
      }
    } catch (error) {
      console.error(`Error extracting content from file: ${file.originalname}`, error);
      throw new Error(`Failed to extract content from file: ${file.originalname}`);
    }
  }

  /**
   * Add papers to the evaluation queue
   */
  queuePapersForProcessing(files) {
    const queueId = `queue-${Date.now()}`;

    this.evaluationQueue.push({
      queueId,
      files,
      status: 'queued',
      progress: 0,
      individualResults: [],
      synthesisResult: null,
      timestamp: new Date()
    });

    if (!this.isProcessingQueue) {
      this.processQueue();
    }

    return queueId;
  }

  /**
   * Process the evaluation queue
   */
  async processQueue() {
    if (this.isProcessingQueue || this.evaluationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const queueItem = this.evaluationQueue[0];
      queueItem.status = 'processing';

      console.log(`Processing queue item ${queueItem.queueId} with ${queueItem.files.length} papers`);

      // Process each paper
      for (let i = 0; i < queueItem.files.length; i++) {
        const file = queueItem.files[i];

        const [detailedEvaluation, conciseEvaluation] = await Promise.all([
          this.evaluatePaper(file, false),
          this.evaluatePaper(file, true)
        ]);

        queueItem.individualResults.push({
          detailed: detailedEvaluation,
          concise: conciseEvaluation,
          file
        });

        queueItem.progress = Math.round(((i + 1) / queueItem.files.length) * 100);
      }

      // Synthesize if needed
      if (queueItem.files.length > 1 && queueItem.individualResults.some(r => r.concise.success)) {
        queueItem.synthesisResult = await this.synthesizePaperEvaluations(queueItem.individualResults);
      } else if (queueItem.individualResults.length === 1 && queueItem.individualResults[0].detailed.success) {
        queueItem.synthesisResult = {
          evaluation: queueItem.individualResults[0].detailed.evaluation,
          success: true
        };
      }

      queueItem.status = 'completed';

      // Store in completedQueue before removing
      this.completedQueue[queueItem.queueId] = queueItem;

      // Remove from active queue
      this.evaluationQueue.shift();

      this.isProcessingQueue = false;
      this.processQueue();
    } catch (error) {
      console.error("Error processing queue:", error);

      if (this.evaluationQueue.length > 0) {
        this.evaluationQueue[0].status = 'failed';
        this.evaluationQueue[0].error = error.message || "Unknown error processing queue";
        this.evaluationQueue.shift();
      }

      this.isProcessingQueue = false;
      this.processQueue();
    }
  }

  /**
   * Get the status of a queued evaluation
   */
  getQueueStatus(queueId) {
    let queueItem = this.evaluationQueue.find(item => item.queueId === queueId);
    if (!queueItem) {
      queueItem = this.completedQueue[queueId];
    }

    if (!queueItem) {
      return null;
    }

    return {
      queueId: queueItem.queueId,
      status: queueItem.status,
      progress: queueItem.progress,
      fileCount: queueItem.files.length,
      completedCount: queueItem.individualResults.length,
      timestamp: queueItem.timestamp
    };
  }

  /**
   * Get the results of a completed evaluation
   */
  getQueueResults(queueId) {
    let queueItem = this.evaluationQueue.find(item => item.queueId === queueId);
    if (!queueItem) {
      queueItem = this.completedQueue[queueId];
    }

    if (!queueItem || queueItem.status !== 'completed') {
      return null;
    }

    // Optionally clean up to prevent memory leaks
    delete this.completedQueue[queueId];

    return {
      queueId: queueItem.queueId,
      individualResults: queueItem.individualResults.map(r => ({
        filename: r.file.originalname,
        evaluation: r.detailed.evaluation,
        success: r.detailed.success
      })),
      synthesisResult: queueItem.synthesisResult,
      timestamp: queueItem.timestamp
    };
  }

  /**
   * Synthesize evaluations of multiple papers
   */
  async synthesizePaperEvaluations(individualResults) {
    try {
      const successfulEvaluations = individualResults
        .filter(result => result.concise.success)
        .map(result => ({
          filename: result.file.originalname,
          evaluation: result.concise.evaluation
        }));

      if (successfulEvaluations.length === 0) {
        return {
          success: false,
          error: "Failed to evaluate any of the papers"
        };
      }

      const synthesisPrompt = `
You are an expert academic evaluator tasked with synthesizing evaluations of multiple research papers.

Based on the concise paper evaluations provided below:

1. Create a consolidated list of the most important findings across all papers, ranked by evidence quality (using the 1-6 scale from the guidelines)
2. Identify any patterns, contradictions, or complementary findings across the papers
3. Provide an overall assessment of the collective evidence presented

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${this.guidelines}

## INDIVIDUAL PAPER EVALUATIONS:
${successfulEvaluations.map((evaluation, index) => `
PAPER ${index + 1}: ${evaluation.filename}
${evaluation.evaluation}
`).join('\n---\n')}

Present your synthesis in a clear, structured format without using tables. First provide the consolidated ranking of key findings across all papers, then your synthesis of how they relate.
`;

      const synthesisResponse = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are an expert academic evaluator synthesizing evaluations of multiple research papers according to evidence quality guidelines."
          },
          {
            role: "user",
            content: synthesisPrompt
          }
        ]
      });

      return {
        evaluation: synthesisResponse.choices[0].message.content,
        success: true
      };
    } catch (error) {
      console.error("OpenAI synthesis error:", error);
      return {
        success: false,
        error: error.message || "Error synthesizing paper evaluations with OpenAI"
      };
    }
  }

  /**
   * Legacy method for comparison of papers
   */
  async comparePapers(files) {
    const queueId = this.queuePapersForProcessing(files);

    // Wait for processing to complete (simpler than using the queue system for existing code)
    const checkInterval = 1000; // 1 second
    const maxWait = 300000; // 5 minutes
    let totalWait = 0;

    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const status = this.getQueueStatus(queueId);

        if (!status) {
          reject(new Error("Queue item not found"));
          return;
        }

        if (status.status === 'completed') {
          const results = this.getQueueResults(queueId);
          resolve(results.synthesisResult || results.individualResults[0]);
          return;
        }

        if (status.status === 'failed') {
          reject(new Error("Processing failed"));
          return;
        }

        totalWait += checkInterval;
        if (totalWait >= maxWait) {
          reject(new Error("Processing timed out"));
          return;
        }

        setTimeout(checkStatus, checkInterval);
      };

      setTimeout(checkStatus, checkInterval);
    });
  }
}

module.exports = OpenAIService;
