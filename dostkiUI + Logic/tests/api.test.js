/**
 * NOTE AI - Backend Integration & System Verification Test Suite
 */

import { TextChunker } from '../src/utils/textChunker.js';
import { EmbeddingService } from '../src/services/embedding.service.js';
import { LlmService } from '../src/services/llm.service.js';
import { generateClassroomCode } from '../src/utils/codeGenerator.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting NOTE AI Test Suite...\n');

  // TEST 1: Unique 6-Character Classroom Code Generator
  console.log('🔹 1. Testing Classroom Code Generator:');
  const codes = new Set();
  for (let i = 0; i < 50; i++) {
    const code = generateClassroomCode(6);
    assert(code.length === 6, `Code length is exactly 6 chars: ${code}`);
    assert(/^[2-9A-HJ-NP-Z]{6}$/.test(code), `Code contains only unambiguous alphanumeric characters: ${code}`);
    codes.add(code);
  }
  assert(codes.size === 50, 'All 50 generated classroom codes are distinct and collision-free');

  // TEST 2: Sliding-Window Text Chunker
  console.log('\n🔹 2. Testing Text Chunker:');
  const sampleNote = `
# Data Structures: Binary Search Trees (BST)

A Binary Search Tree is a node-based binary tree data structure which has the following properties:
The left subtree of a node contains only nodes with keys lesser than the node's key.
The right subtree of a node contains only nodes with keys greater than the node's key.
The left and right subtree each must also be a binary search tree.

## Time Complexity
- Search: O(log N) average, O(N) worst case
- Insertion: O(log N) average, O(N) worst case
- Deletion: O(log N) average, O(N) worst case

## Applications
BSTs are used in indexing databases, implementing associative arrays, and priority queues.
In modern AI systems, balanced trees or hierarchical graph structures like HNSW are used for indexing vector spaces.
  `.repeat(10);

  const chunks = TextChunker.splitText(sampleNote, {
    maxTokens: 100,
    overlapTokens: 20,
    metadata: { fileName: 'BST_Notes.pdf' },
  });

  assert(chunks.length > 1, `Document successfully split into ${chunks.length} overlapping chunks`);
  assert(chunks[0].chunkText.length > 0, 'First chunk contains valid text');
  assert(chunks[0].tokenCount > 0, `Estimated token count calculated: ${chunks[0].tokenCount}`);
  assert(chunks[0].metadata.fileName === 'BST_Notes.pdf', 'Metadata correctly preserved across chunks');
  assert(chunks[0].metadata.totalChunks === chunks.length, 'Total chunks count annotated in chunk metadata');

  // TEST 3: 1536-Dimensional Vector Embedding Service
  console.log('\n🔹 3. Testing Embedding Service (1536 Dimensions):');
  const textA = 'What is the time complexity of searching in a Binary Search Tree?';
  const textB = 'Binary Search Tree search complexity is O(log N) on average.';
  const textC = 'Photosynthesis is the process used by plants to convert light into chemical energy.';

  const embeddingA = await EmbeddingService.generateEmbedding(textA);
  const embeddingB = await EmbeddingService.generateEmbedding(textB);
  const embeddingC = await EmbeddingService.generateEmbedding(textC);

  assert(Array.isArray(embeddingA), 'Embedding output is an array');
  assert(embeddingA.length === 1536, `Embedding has exactly 1536 dimensions (actual: ${embeddingA.length})`);
  assert(embeddingB.length === 1536, `Embedding B has 1536 dimensions`);

  const pgVectorStr = EmbeddingService.toPgVector(embeddingA);
  assert(pgVectorStr.startsWith('[') && pgVectorStr.endsWith(']'), 'Vector formats properly for PostgreSQL pgvector');

  // Compute Cosine Similarity between vectors
  function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  const simAB = cosineSimilarity(embeddingA, embeddingB);
  const simAC = cosineSimilarity(embeddingA, embeddingC);

  console.log(`    📊 Similarity(A, B) [Related CS Topics]:    ${simAB.toFixed(4)}`);
  console.log(`    📊 Similarity(A, C) [Unrelated Topic]:       ${simAC.toFixed(4)}`);
  assert(simAB > simAC, 'Related technical passages have higher cosine similarity than unrelated topics');

  // TEST 4: Contextual RAG Response Generation
  console.log('\n🔹 4. Testing RAG AI Answer Engine:');
  const ragResult = await LlmService.generateRagAnswer(
    'What is the search time complexity of BST?',
    [
      {
        fileName: 'BST_Notes.pdf',
        chunkText: 'Binary Search Tree search time complexity is O(log N) on average and O(N) in the worst case.',
        similarity: 0.94,
      },
    ],
    'Data Structures & Algorithms'
  );

  assert(typeof ragResult.answer === 'string' && ragResult.answer.length > 20, 'RAG answer generated successfully');
  assert(ragResult.sources.length === 1, 'Sources correctly cited in RAG response');
  assert(ragResult.sources[0].fileName === 'BST_Notes.pdf', 'Source file name preserved');

  // TEST 5: Document Summarization & Takeaways
  console.log('\n🔹 5. Testing Document Summarizer:');
  const summaryResult = await LlmService.generateSummary(sampleNote, 'BST_Notes.pdf');
  assert(typeof summaryResult.summary === 'string', 'Summary generated');
  assert(Array.isArray(summaryResult.keyTakeaways) && summaryResult.keyTakeaways.length > 0, 'Key takeaways generated');
  assert(Array.isArray(summaryResult.coreConcepts) && summaryResult.coreConcepts.length > 0, 'Core concepts mapped');

  // TEST 6: Structured MCQ & Quiz Generator
  console.log('\n🔹 6. Testing Interactive Quiz Generator:');
  const quizResult = await LlmService.generateQuiz(sampleNote, 5);
  assert(Array.isArray(quizResult.mcqs) && quizResult.mcqs.length > 0, 'MCQs generated');
  assert(quizResult.mcqs[0].options.length === 4, 'MCQ has 4 options');
  assert(typeof quizResult.mcqs[0].correctOptionIndex === 'number', 'MCQ has correct answer index');
  assert(Array.isArray(quizResult.shortQuestions), 'Short answer questions generated');

  console.log(`\n======================================================`);
  console.log(`🏆 Test Results: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`======================================================\n`);

  if (passedTests === totalTests) {
    console.log('🎉 All core components verified successfully!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
