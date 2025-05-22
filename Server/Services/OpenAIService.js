const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const pdf = require("pdf-parse");

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
    this.completedQueue = {};
    this.isProcessingQueue = false;
  }

  /**
   * Evaluate a single research paper and extract key findings with proper source linking
   */
  async evaluatePaper(file, returnConcise = false) {
    try {
      const { content, metadata } = await this.extractFileContent(file);

      const detailedPrompt = `
You are an academic research paper evaluator with expertise in scientific methodology and evidence quality. Your task is to extract and evaluate key findings from the attached research paper using the evaluation framework detailed below.

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${this.guidelines}

## SOURCE CITATION REQUIREMENTS
You MUST include proper source citations for each key finding using the following guidelines:
1. Always link DOIs in the format: [doi: DOI_NUMBER](https://doi.org/DOI_NUMBER)
2. For papers with detected DOIs, use them in your source citations. Here are the DOIs found in this paper: ${metadata.dois ? metadata.dois.join(', ') : 'None detected'}
3. Each key finding must have a properly formatted source citation that includes both the paper title and a DOI link when available
4. When a DOI is available, create a clickable link using the format: [Paper Title](https://doi.org/DOI_NUMBER)

## EVALUATION INSTRUCTIONS
1. Extract 3-5 main key findings from the research paper.
2. For each key finding, provide the following structure:

### Key Finding #[number]
- **Criteria**: What this finding is about (e.g., a specific intervention, observation, or relationship)
- **Value**: The specific result or outcome that was discovered
- **Evidence Level**: Assign an evidence level (1-6) based on the guidelines and justify this classification
- **Source**: When citing the source, include the paper title AND any available URL, DOI, or permalink in proper markdown link format: [Paper Title](URL). If a DOI is available, include it as a link formatted as [doi: DOI_NUMBER](https://doi.org/DOI_NUMBER).
- **Methodology Quality**: Assessment of how the finding was determined (sample size, controls, etc.)
- **Importance**: Why this finding matters in the context of the research field

Apply the appropriate evidence level classification from the guidelines.txt for each finding to determine it

## PAPER METADATA
- Filename: ${metadata.filename}
- DOIs found: ${metadata.dois ? metadata.dois.join(', ') : 'None detected'}
- URLs found: ${metadata.urls ? metadata.urls.join(', ') : 'None detected'}

## PAPER CONTENT:
${content}
`;

      const concisePrompt = `
You are an academic research paper evaluator with expertise in scientific methodology and evidence quality. Your task is to extract and summarize key findings from the attached research paper.

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${this.guidelines}

## SOURCE CITATION REQUIREMENTS
You MUST include proper source citations for each key finding using the following guidelines:
1. Always link DOIs in the format: [doi: DOI_NUMBER](https://doi.org/DOI_NUMBER)
2. For papers with detected DOIs, use them in your source citations. Here are the DOIs found in this paper: ${metadata.dois ? metadata.dois.join(', ') : 'None detected'}
3. Each key finding must have a properly formatted source citation that includes both the paper title and a DOI link when available
4. When a DOI is available, create a clickable link using the format: [Paper Title](https://doi.org/DOI_NUMBER)

## INSTRUCTIONS
1. Extract 3-5 main key findings from the research paper.
2. For each key finding, provide a summary with:
   - Description of the key finding
   - Evidence level (1-6) based on the guidelines
   - Methodology quality
   - Source information with proper link formatting: [Paper Title](URL) if a URL is available, or include DOI as [doi: DOI_NUMBER](https://doi.org/DOI_NUMBER)

## PAPER METADATA
- Filename: ${metadata.filename}
- DOIs found: ${metadata.dois ? metadata.dois.join(', ') : 'None detected'}
- URLs found: ${metadata.urls ? metadata.urls.join(', ') : 'None detected'}

## PAPER CONTENT:
${content}
`;

      const prompt = returnConcise ? concisePrompt : detailedPrompt;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are an academic research paper evaluator focused on extracting and evaluating key findings according to evidence quality guidelines. Always format source references as clickable markdown links where possible. Make sure to include DOI links in the format [doi: DOI_NUMBER](https://doi.org/DOI_NUMBER) for every key finding where a DOI is available."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      let formattedContent = this.ensureProperDoiFormatting(response.choices[0].message.content, metadata.dois);

      return {
        evaluation: formattedContent,
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

  //Ensure all DOIs in the content are properly formatted as clickable links
  ensureProperDoiFormatting(content, detectedDois) {
    if (!detectedDois || detectedDois.length === 0) {
      return content;
    }
  
    // First apply extreme fixes to handle the nesting issues
    let formattedContent = this.fixExtremeDoiFormatting(content);
  
    // Transform any plain DOI mentions into proper links
    detectedDois.forEach(doi => {
      const cleanDoi = doi.replace(/^doi:\s*/i, '').trim();
      
      // Check if this DOI is already properly formatted in the content
      const formattedDoiPattern = new RegExp(`\\[([^\\[\\]]+)\\]\\(https://doi\\.org/${this.escapeRegExp(cleanDoi)}\\)`, 'i');
      if (formattedDoiPattern.test(formattedContent)) {
        // This DOI is already properly formatted somewhere in the content, skip reformatting
        return;
      }
      
      // Various patterns to find DOI mentions that aren't already properly formatted as links
      const doiPatterns = [
        // Standard DOI mention
        new RegExp(`(doi:\\s*${this.escapeRegExp(cleanDoi)})(?!\\))`, 'gi'),
        // DOI without prefix but matching the exact ID (more restrictive to avoid false positives)
        new RegExp(`(?<!\\[)(?<!\\()(?<!\\/)(${this.escapeRegExp(cleanDoi)})(?!\\))(?!\\])(?!\/\])`, 'g'),
        // DOI in brackets without link formatting
        new RegExp(`\\[(doi:\\s*${this.escapeRegExp(cleanDoi)})\\](?!\\()`, 'gi')
      ];
        
      // Replace each pattern with properly formatted DOI links
      doiPatterns.forEach(pattern => {
        try {
          formattedContent = formattedContent.replace(
            pattern, 
            `[doi: ${cleanDoi}](https://doi.org/${cleanDoi})`
          );
        } catch (error) {
          // If there's an error with the regex (e.g., lookbehind not supported), fall back to simpler pattern
          const simplePattern = new RegExp(`(doi:\\s*${this.escapeRegExp(cleanDoi)})`, 'gi');
          formattedContent = formattedContent.replace(
            simplePattern, 
            `[doi: ${cleanDoi}](https://doi.org/${cleanDoi})`
          );
        }
      });
    });
    
    // Final cleanup to ensure no double-formatted DOIs remain
    formattedContent = formattedContent.replace(
      /\[doi: (10\.\d{4,}\/[^\s\[\]\(\)]+)\]\(https:\/\/doi\.org\/[^\)]+\)/g,
      `[doi: $1](https://doi.org/$1)`
    );
    
    // Clean up any duplicate DOIs in final output
    formattedContent = this.cleanupSequentialDOIs(formattedContent);
    
    // One final extreme fix pass
    return this.fixExtremeDoiFormatting(formattedContent);
  }

  /**
 * Helper method to clean up sequential duplicate DOIs
 * This specifically addresses the issue shown in the example
 */
cleanupSequentialDOIs(content) {
  // Initialize cleaned content
  let cleanedContent = content;
  
  // Keep track of which DOIs we've processed to avoid duplicate replacements
  const processedDoiLinks = new Set();
  
  // First fix any sequences of identical DOI links like (https://doi.org/10.1016/j)(https://doi.org/10.1016/j)...
  const doiUrlPattern = /\(https:\/\/doi\.org\/([^\)]+)\)/g;
  let match;
  
  // Find all DOI links
  const doiLinks = [];
  while ((match = doiUrlPattern.exec(content)) !== null) {
    doiLinks.push({
      fullMatch: match[0],
      doi: match[1],
      index: match.index
    });
  }
  
  // Find sequences of the same DOI
  for (let i = 0; i < doiLinks.length; i++) {
    const currentLink = doiLinks[i];
    
    // Skip if we've already processed this one
    if (processedDoiLinks.has(i)) continue;
    
    // Start a new sequence with this link
    const sequence = [currentLink];
    processedDoiLinks.add(i);
    
    // Look ahead to find consecutive identical DOIs
    for (let j = i + 1; j < doiLinks.length; j++) {
      const nextLink = doiLinks[j];
      
      // Check if this link is the same DOI and immediately follows the previous one
      if (nextLink.doi === currentLink.doi && 
          nextLink.index === sequence[sequence.length - 1].index + sequence[sequence.length - 1].fullMatch.length) {
        sequence.push(nextLink);
        processedDoiLinks.add(j);
      } else {
        // Not consecutive or not the same DOI, break the sequence
        break;
      }
    }
    
    // If we found a sequence, replace it with a single instance
    if (sequence.length > 1) {
      const fullSequence = sequence.map(link => link.fullMatch).join('');
      cleanedContent = cleanedContent.replace(fullSequence, sequence[0].fullMatch);
    }
  }
  
  // Fix any remaining patterns of nested DOI brackets
  cleanedContent = cleanedContent.replace(
    /\[\[\[\[\[\[\[doi: (10\.\d{4,}\/[^\]]+)\]\]\]\]\]\]\]/g, 
    '[doi: $1]'
  );
  
  return cleanedContent;
}

/**
 * Add a new method to handle extreme cases like in the example
 */
fixExtremeDoiFormatting(content) {
  let fixed = content;
  
  // Handle the specific case from your example with multiple nested DOIs
  const extremePattern = /\[([^\[\]]+)\]\(https:\/\/doi\.org\/\[\[\[\[\[\[\[doi:\s*(10\.\d{4,}\/[^\s\[\]\(\)]+)\]\]\]\]\]\]\]\)/gi;
  fixed = fixed.replace(extremePattern, '[$1](https://doi.org/$2)');
  
  // Fix cases where the URL in markdown contains another markdown link
  const nestedLinkPattern = /\[([^\[\]]+)\]\(https:\/\/doi\.org\/\[([^\[\]]+)\]\(https:\/\/doi\.org\/([^\)]+)\)\)/g;
  fixed = fixed.replace(nestedLinkPattern, '[$1](https://doi.org/$3)');
  
  // Fix cases where there are sequential duplicate DOIs in the source citation
  const duplicateSourcePattern = /\[([^\[\]]+)\]\(((?:https:\/\/doi\.org\/[^\)]+\))+)\)/g;
  fixed = fixed.replace(duplicateSourcePattern, (match, title, urls) => {
    // Extract the first DOI URL from the duplicated set
    const firstUrl = urls.match(/https:\/\/doi\.org\/[^\)]+/)[0];
    return `[${title}](${firstUrl})`;
  });
  
  // Handle the extreme case from the example
  fixed = fixed.replace(
    /\(https:\/\/doi\.org\/\[\[\[\[\[\[\[doi:\s*(10\.\d{4,}\/[^\s\[\]\(\)]+)\]\]\]\]\]\]\]\)/gi,
    '(https://doi.org/$1)'
  );
  
  // Fix multiple sequential identical DOI references
  const sequentialPattern = /(\(https:\/\/doi\.org\/10\.\d{4,}\/[^\)]+\))(\1)+/g;
  fixed = fixed.replace(sequentialPattern, '$1');
  
  return fixed;
}

  /**
   * Extract content from various file types with source metadata
   */
  async extractFileContent(file) {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      let content = '';
      let metadata = {
        filename: file.originalname,
        dois: [],
        urls: [],
        title: null,
        authors: [],
        publicationYear: null,
        abstract: null
      };
  
      // Extract content based on file type
      if (fileExtension === '.pdf') {
        console.log(`Processing PDF file: ${file.originalname}`);
        const dataBuffer = fs.readFileSync(file.path);
        
        // Use more options with pdf-parse for better extraction
        const pdfData = await pdf(dataBuffer, {
          // Max pages to parse (0 for all pages)
          max: 0,
          // Return text in paragraphs rather than pages
          paragraphs: true,
          // Attempt to preserve lists and tables
          preserveStructure: true
        });
        
        content = pdfData.text;
        
        // Extract potential title (usually first few lines of PDF)
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        if (lines.length > 0) {
          // The title is likely one of the first prominent lines that isn't a journal name
          // Try to find a line that doesn't look like a header or journal name
          const potentialTitles = lines.slice(0, 5).filter(line => 
            line.length > 15 && 
            !/journal|volume|issue|doi|www|http|©|published by|all rights reserved/i.test(line)
          );
          
          if (potentialTitles.length > 0) {
            metadata.title = potentialTitles[0].trim();
          }
        }
        
        // Try to extract abstract
        const abstractMatch = content.match(/abstract[\s\n]*([^]*?)(?=introduction|materials and methods|results|discussion|conclusions|references|acknowledgments|keywords)/i);
        if (abstractMatch && abstractMatch[1]) {
          metadata.abstract = abstractMatch[1].trim();
        }
        
      } else if (['.txt', '.md', '.rtf'].includes(fileExtension)) {
        console.log(`Processing text file: ${file.originalname}`);
        content = fs.readFileSync(file.path, 'utf8');
      } else {
        console.log(`Unsupported file type: ${fileExtension}, attempting to process as text`);
        try {
          content = fs.readFileSync(file.path, 'utf8');
        } catch (e) {
          // If reading as UTF-8 fails, try reading as binary and then convert
          const buffer = fs.readFileSync(file.path);
          // Try to detect encoding or use a library like 'chardet' for better detection
          content = buffer.toString('utf8');
        }
      }
      
      // Enhanced metadata extraction regardless of file type
      metadata = {
        ...metadata,
        ...this.extractEnhancedMetadata(content)
      };
      
      return { content, metadata };
    } catch (error) {
      console.error(`Error extracting content from file: ${file.originalname}`, error);
      throw new Error(`Failed to extract content from file: ${file.originalname}`);
    }
  }

  escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Extract enhanced metadata from content
   */
  extractEnhancedMetadata(content) {
    const metadata = {
      dois: [],
      urls: [],
      authors: [],
      publicationYear: null,
      references: []
    };
  
    // Extract DOIs using multiple patterns
    const doiPatterns = [
      /\bdoi:\s*(10\.\d{4,}\/[^\s\]\)\.,;]+)/gi,                 // Standard DOI format
      /https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^\s\]\)\.,;]+)/gi,  // DOI URL format
      /[\[\(]doi:?\s*(10\.\d{4,}\/[^\s\]\)\.,;]+)[\]\)]/gi,      // DOI in brackets
      /\bDOI\s*=\s*["{]?(10\.\d{4,}\/[^\s\]\)\.,;"{}]+)["}]?/gi, // DOI in BibTeX or similar
      /Digital\s+Object\s+Identifier\s*:?\s*(10\.\d{4,}\/[^\s\]\)\.,;]+)/gi // Full DOI mention
    ];
    
    let doiMatches = [];
    doiPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        doiMatches.push(match[1]);
      }
    });
    
    // Clean and deduplicate DOIs
    metadata.dois = [...new Set(doiMatches)]
      .map(doi => doi.trim().replace(/[,\.;:"\]}]$/, ''))
      .filter(doi => /^10\.\d{4,}\//.test(doi));
    
    // Extract URLs (excluding DOI URLs)
    const urlPattern = /(https?:\/\/(?!(?:dx\.)?doi\.org)[^\s"<>\[\]\(\)]+)/gi;
    const urlMatches = content.match(urlPattern) || [];
    metadata.urls = [...new Set(urlMatches)]
      .map(url => url.trim().replace(/[,\.;:"\]}]$/, ''))
      .slice(0, 10); // Limit to 10 URLs
    
    // Try to extract authors
    // Look for patterns like "Author1, Author2, and Author3" or "Author1; Author2; Author3"
    const authorSectionMatch = content.match(/authors?[:;\s]*([^]*?)(?=abstract|introduction|keywords|affiliations)/i);
    if (authorSectionMatch && authorSectionMatch[1]) {
      const authorSection = authorSectionMatch[1].trim();
      // Split by common author separators
      const potentialAuthors = authorSection.split(/(?:,\s*|\s+and\s+|;\s*|\n+)/)
        .map(a => a.trim())
        .filter(a => 
          a.length > 0 && 
          a.length < 50 && // Author names shouldn't be too long
          !/^(abstract|introduction|keywords|university|department|received|accepted|revised)/i.test(a) &&
          /[A-Za-z]/.test(a) // Must contain at least one letter
        );
      
      if (potentialAuthors.length > 0) {
        metadata.authors = potentialAuthors;
      }
    }
    
    // Try to extract publication year
    const yearPatterns = [
      /(?:©|copyright|\bpublished\b|\breceived\b|\baccepted\b|\b(?:19|20)\d{2}\b)/i,
      /\((?:19|20)\d{2}\)/,
      /\b(?:19|20)\d{2}\b/
    ];
    
    for (const pattern of yearPatterns) {
      const yearMatch = content.match(pattern);
      if (yearMatch) {
        // Extract just the year from the match
        const yearExtract = yearMatch[0].match(/(19|20)\d{2}/);
        if (yearExtract) {
          metadata.publicationYear = parseInt(yearExtract[0]);
          break;
        }
      }
    }
    
    // Try to extract references
    const referencesMatch = content.match(/references[\s\n]*([^]*?)(?=appendix|supplementary|acknowledgments|$)/i);
    if (referencesMatch && referencesMatch[1]) {
      const referencesSection = referencesMatch[1].trim();
      
      // Split references section by common patterns like [1], 1., etc.
      const referenceEntries = referencesSection
        .split(/\n\s*(?:\[\d+\]|\d+\.|\[\w+\d+\])\s*/)
        .filter(entry => entry.trim().length > 20) // Must be substantive
        .map(entry => entry.trim())
        .slice(0, 30); // Limit to 30 references
      
      if (referenceEntries.length > 0) {
        metadata.references = referenceEntries;
      }
    }
    
    return metadata;
  }

  /**
   * Add papers to the evaluation queue
   */
  queuePapersForProcessing(files) {
    const queueId = `queue-${Date.now()}`;

    this.evaluationQueue.push({
      queueId,
      files,
      status: "queued",
      progress: 0,
      individualResults: [],
      synthesisResult: null,
      timestamp: new Date(),
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
      queueItem.status = "processing";

      console.log(
        `Processing queue item ${queueItem.queueId} with ${queueItem.files.length} papers`
      );

      // Process each paper
      for (let i = 0; i < queueItem.files.length; i++) {
        const file = queueItem.files[i];

        const [detailedEvaluation, conciseEvaluation] = await Promise.all([
          this.evaluatePaper(file, false),
          this.evaluatePaper(file, true),
        ]);

        queueItem.individualResults.push({
          detailed: detailedEvaluation,
          concise: conciseEvaluation,
          file,
        });

        queueItem.progress = Math.round(
          ((i + 1) / queueItem.files.length) * 100
        );
      }

      if (
        queueItem.files.length > 1 &&
        queueItem.individualResults.some((r) => r.concise.success)
      ) {
        queueItem.synthesisResult = await this.synthesizePaperEvaluations(
          queueItem.individualResults
        );
      } else if (
        queueItem.individualResults.length === 1 &&
        queueItem.individualResults[0].detailed.success
      ) {
        queueItem.synthesisResult = {
          evaluation: queueItem.individualResults[0].detailed.evaluation,
          success: true,
        };
      }

      queueItem.status = "completed";
      this.completedQueue[queueItem.queueId] = queueItem;
      this.evaluationQueue.shift();

      this.isProcessingQueue = false;
      this.processQueue();
    } catch (error) {
      console.error("Error processing queue:", error);

      if (this.evaluationQueue.length > 0) {
        this.evaluationQueue[0].status = "failed";
        this.evaluationQueue[0].error =
          error.message || "Unknown error processing queue";
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
    let queueItem = this.evaluationQueue.find(
      (item) => item.queueId === queueId
    );
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
      timestamp: queueItem.timestamp,
    };
  }

  /**
   * Get the results of a completed evaluation
   */
  getQueueResults(queueId) {
    let queueItem = this.evaluationQueue.find(
      (item) => item.queueId === queueId
    );
    if (!queueItem) {
      queueItem = this.completedQueue[queueId];
    }

    if (!queueItem || queueItem.status !== "completed") {
      return null;
    }

    // Optionally clean up to prevent memory leaks
    delete this.completedQueue[queueId];

    return {
      queueId: queueItem.queueId,
      individualResults: queueItem.individualResults.map((r) => ({
        filename: r.file.originalname,
        evaluation: r.detailed.evaluation,
        success: r.detailed.success,
      })),
      synthesisResult: queueItem.synthesisResult,
      timestamp: queueItem.timestamp,
    };
  }

  /**
   * Synthesize evaluations of multiple papers
   */
  async synthesizePaperEvaluations(individualResults) {
    try {
      const successfulEvaluations = individualResults
        .filter((result) => result.concise.success)
        .map((result) => ({
          filename: result.file.originalname,
          evaluation: result.concise.evaluation,
        }));

      if (successfulEvaluations.length === 0) {
        return {
          success: false,
          error: "Failed to evaluate any of the papers",
        };
      }

      // Collect all DOIs mentioned in the individual evaluations
      const mentionedDois = [];
      successfulEvaluations.forEach(evalute => {
        const doiMatches = evalute.evaluation.match(/doi:\s*(10\.\d{4,}\/[^\s\)\]]+)/gi);
        if (doiMatches && doiMatches.length > 0) {
          doiMatches.forEach(doiMatch => {
            const cleanDoi = doiMatch.replace(/^doi:\s*/i, '').trim();
            mentionedDois.push(cleanDoi);
          });
        }
      });

      const synthesisPrompt = `
You are an expert academic evaluator tasked with synthesizing evaluations of multiple research papers according to a rigorous evidence‐quality framework.

## EVIDENCE QUALITY ASSESSMENT GUIDELINES
${this.guidelines}

## SOURCE CITATION REQUIREMENTS
You MUST include proper source citations for each key finding using the following guidelines:
1. Always link DOIs in the format: [doi: DOI_NUMBER](https://doi.org/DOI_NUMBER)
2. For papers with detected DOIs, use them in your source citations. Here are the DOIs found: ${mentionedDois.length > 0 ? mentionedDois.join(', ') : 'None detected'}
3. Each key finding must have a properly formatted source citation that includes both the paper title and a DOI link when available
4. When a DOI is available, create a clickable link using the format: [Paper Title](https://doi.org/DOI_NUMBER)

## SYNTHESIS INSTRUCTIONS

1. **Consolidated Chronological Ranking**  
   Combine all key findings into one ranked list sorted first by evidence level (1 = highest, 6 = lowest), and—where levels tie—by the original publication or experimental date. For each ranked finding, present:
   ### Rank #[number]
   - **Finding**: A concise statement of the result  
   - **Evidence Level**: 1–6 (justify your assignment based on the guidelines)  
   - **Source**: Paper title, authors, publication year, and section/figure or page reference. Always include DOI links when available in the format [doi: DOI_NUMBER](https://doi.org/DOI_NUMBER)  
   - **Context & Methodology**: Briefly note the experimental design or analysis approach that produced this result  

2. **Patterns, Complementarities & Contradictions**  
   After your ranked list, discuss:
   - **Recurring Themes**: Topics or interventions that appear across multiple papers  
   - **Complementary Findings**: How one paper's results reinforce or build on another's  
   - **Contradictions**: Any direct conflicts or divergent outcomes, with possible reasons  

3. **Overall Evidence Assessment & Recommendations**  
   Conclude with:  
   - A summary of the collective strength and reliability of the evidence  
   - Key gaps or uncertainties revealed by the synthesis  
   - Clear recommendations for future studies needed to resolve contradictions or address under‐investigated areas  

## INDIVIDUAL PAPER EVALUATIONS
${successfulEvaluations
  .map(
    (evaluation, index) => `
PAPER ${index + 1}: ${evaluation.filename}
${evaluation.evaluation}
`
  )
  .join("\n---\n")}

Please structure your response with the headings above, avoid using tables, and anchor every point to its original context in the source papers.
`;

      const synthesisResponse = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert academic evaluator synthesizing evaluations of multiple research papers according to evidence quality guidelines. Always format DOI references as clickable links using the format [doi: DOI_NUMBER](https://doi.org/DOI_NUMBER).",
          },
          {
            role: "user",
            content: synthesisPrompt,
          },
        ],
      });

      let formattedContent = this.ensureProperDoiFormatting(
        synthesisResponse.choices[0].message.content, 
        mentionedDois
      );

      return {
        evaluation: formattedContent,
        success: true,
      };
    } catch (error) {
      console.error("OpenAI synthesis error:", error);
      return {
        success: false,
        error:
          error.message || "Error synthesizing paper evaluations with OpenAI",
      };
    }
  }

  /**
   * Legacy method for comparison of papers
   */
  async comparePapers(files) {
    const queueId = this.queuePapersForProcessing(files);

    const checkInterval = 1000;
    const maxWait = 300000; // 5 min
    let totalWait = 0;

    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const status = this.getQueueStatus(queueId);

        if (!status) {
          reject(new Error("Queue item not found"));
          return;
        }

        if (status.status === "completed") {
          const results = this.getQueueResults(queueId);
          resolve(results.synthesisResult || results.individualResults[0]);
          return;
        }

        if (status.status === "failed") {
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