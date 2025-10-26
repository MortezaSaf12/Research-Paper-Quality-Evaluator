# Research Paper Quality Evaluator

[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991)](https://openai.com/)

AI-powered research paper evaluation tool that automatically assesses academic papers using evidence-quality
frameworks. Saves educators hours by analyzing up to 12 papers simultaneously, ranking them by methodological
rigor and PRISMA guideline adherence. Built with Node.js, Express, and OpenAI GPT-4o-mini.



## Problem Statement

Academic researchers and educators face a time-consuming challenge: manually reviewing multiple research papers to
determine which sources meet the highest quality standards. This process can take hours per paper, involving:
- Assessing methodological rigor
- Evaluating evidence quality levels (1-6)
- Checking PRISMA guideline adherence
- Comparing findings across multiple papers

**This tool automates that entire process**

## Key Features

### Intelligent Paper Analysis
- **Single Paper Evaluation**: Deep analysis of individual research papers with detailed findings extraction
- **Multi-Paper Comparison**: Simultaneous evaluation of up to 12 papers with ranked comparison
- **Evidence Level Classification**: Automatic assignment of evidence levels (1-6) based on academic frameworks
- **Methodology Quality Assessment**: Evaluation of sample sizes, controls, randomization, and bias mitigation

### What Gets Evaluated
- Study design type (RCT, quasi-experimental, observational, qualitative)
- Evidence quality level (systematic review → manufacturer recommendations)
- Methodology rigor and bias controls
- Key findings with proper source citations
- DOI and reference extraction
- PRISMA guideline compliance for systematic reviews

### Export Capabilities
- **PDF Reports**: Publication-ready formatted evaluations
- **Excel Spreadsheets**: Structured data with key findings, evidence levels, and methodology quality
- Automatic DOI linking and source attribution

## Technology Stack

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- jsPDF
- SheetJS

**Backend:*
- Node.js with Express.js
- OpenAI API (GPT-4o-mini)  (Can be updated to superior and more accurate models)
- pdf-parse, Multer for file handling

**AI Integration:**
- Custom prompts based on academic evaluation frameworks
- Structured output for consistent analysis
- DOI and metadata extraction
- Multi-paper synthesis capabilities

## Getting Started

### Prerequisites
- Node.js (v14.0.0 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/research-paper-quality-evaluator.git
cd research-paper-quality-evaluator
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
# Create a .env file in the Server directory
echo "SECRET_OPENAI_KEY=your_openai_api_key_here" > Server/.env
echo "PORT=3001" >> Server/.env
```

4. **Start the server**
```bash
cd Server
node Server.js
```

## Authors
- Morteza Safari
- Oscar Assaf
