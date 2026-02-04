# Research Paper Quality Evaluator

[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991)](https://openai.com/) (Replace with desired LLM model)

An AI-powered research paper evaluation tool that automatically assesses academic papers using evidence-quality frameworks. Saves educators hours by analyzing up to 12 papers simultaneously, ranking them by methodological rigor and PRISMA guideline adherence.

## About

Academic researchers and educators face a time-consuming challenge: manually reviewing multiple research papers to determine which sources meet the highest quality standards. This process can take hours per paper, involving:

- Assessing methodological rigor
- Evaluating evidence quality levels (1-6)
- Checking PRISMA guideline adherence
- Comparing findings across multiple papers

**This tool automates that entire process.**

## Features

**Intelligent Paper Analysis**
- Single paper evaluation with detailed findings extraction
- Multi-paper comparison of up to 12 papers with ranked results
- Evidence level classification (1-6) based on academic frameworks
- Methodology quality assessment including sample sizes, controls, randomization, and bias mitigation

**What Gets Evaluated**
- Study design type (RCT, quasi-experimental, observational, qualitative)
- Evidence quality level (systematic review → manufacturer recommendations)
- Methodology rigor and bias controls
- Key findings with proper source citations
- DOI and reference extraction
- PRISMA guideline compliance for systematic reviews

**Export Capabilities**
- PDF reports in publication-ready format
- Excel spreadsheets with structured data, evidence levels, and methodology quality
- Automatic DOI linking and source attribution

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla), jsPDF, SheetJS |
| Backend | Node.js, Express.js, pdf-parse, Multer |
| AI | OpenAI API (GPT-4o-mini) |

## Project Structure

```
Research-Paper-Quality-Evaluator/
├── Client/                 # Frontend application
├── Server/                 # Backend API server
│   └── Server.js           # Express server entry point
├── .vscode/                # VS Code configuration
├── package.json            # Project dependencies
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MortezaSaf12/Research-Paper-Quality-Evaluator.git
   cd Research-Paper-Quality-Evaluator
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

5. **Access the application**
   
   Open your browser and navigate to the client application (typically `http://localhost:3001` or open the Client HTML file directly).

## Usage

1. **Upload Papers** — Select one or more research papers (PDF format) to evaluate
2. **Choose Evaluation Mode** — Single paper analysis or multi-paper comparison
3. **Review Results** — View evidence levels, methodology assessments, and key findings
4. **Export** — Download results as PDF or Excel for further use

## API Configuration

The tool uses OpenAI's GPT-4o-mini by default. To use a different model, update the API configuration in the server code. More advanced models may provide increased accuracy for complex evaluations.

## Authors

- **Morteza Safari** — [GitHub](https://github.com/MortezaSaf12)
- **Oscar Assaf**

## Acknowledgments

- [OpenAI](https://openai.com/) for the GPT API
- Academic evaluation frameworks that informed the assessment criteria

---

Project Link: [https://github.com/MortezaSaf12/Research-Paper-Quality-Evaluator](https://github.com/MortezaSaf12/Research-Paper-Quality-Evaluator)
