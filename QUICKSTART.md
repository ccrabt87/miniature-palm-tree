# Quick Start Guide - K-12 AI Tutoring Agent

## Installation and Setup

### 1. Install Python
Make sure you have Python 3.7 or higher installed:
```bash
python --version
```

### 2. Clone the Repository
```bash
git clone https://github.com/ccrabt87/miniature-palm-tree.git
cd miniature-palm-tree
```

## Running the Tutor

### Option 1: Basic Demo
See all features in action:
```bash
python k12_tutor.py
```

### Option 2: Interactive Examples
Choose different modes:
```bash
python examples.py
```
Then select:
- `1` for Interactive Session (full tutoring experience)
- `2` for Quick Practice (answer 3 questions)
- `3` for Feature Demonstration

### Option 3: Use in Your Code
```python
from k12_tutor import K12TutorAgent, GradeLevel, Subject

# Create tutor
tutor = K12TutorAgent()

# Start session
tutor.start_session("Your Name", GradeLevel.FIFTH, Subject.MATH)

# Get a question
question = tutor.ask_question("math_elementary")
print(question.question_text)

# Check answer
result = tutor.check_answer(question, "12")
print(result["feedback"])
```

## Running Tests
Verify everything works:
```bash
python test_k12_tutor.py
```

## Key Features

### 1. Tutoring Sessions
- Start personalized sessions
- Track progress
- Get feedback

### 2. Practice Questions
- Multiple subjects
- Grade-appropriate content
- Instant feedback

### 3. Study Help
- Concept explanations
- Study tips
- Hints when needed

### 4. Test Preparation
- Test-taking strategies
- Study schedules
- Subject-specific advice

## Available Subjects
- Mathematics (all levels)
- Science
- English/Language Arts
- Reading & Writing
- History/Social Studies
- Advanced: Algebra, Geometry, Calculus, Biology, Chemistry, Physics

## Grade Levels
- Elementary: K-5
- Middle School: 6-8
- High School: 9-12

## Next Steps
1. Run the demo to see it in action
2. Try the interactive mode
3. Integrate into your own project
4. Add more questions and subjects

## Getting Help
- Check README.md for detailed documentation
- Run tests to verify installation
- See examples.py for usage patterns

Happy learning! 🎓
