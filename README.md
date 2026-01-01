# K-12 AI Tutoring Agent 🎓

An AI-powered tutoring agent designed specifically for K-12 students to help with education and test preparation across all major subjects.

## Features

✨ **Comprehensive Subject Coverage**
- Mathematics (Elementary through Calculus)
- Science (General Science, Biology, Chemistry, Physics)
- English/Language Arts
- Reading & Writing
- History/Social Studies
- Geography

🎯 **Grade-Specific Content**
- Kindergarten through 12th grade
- Age-appropriate questions and explanations
- Progressive difficulty levels

📚 **Test Preparation**
- Study guides and strategies
- Practice questions with detailed explanations
- Test-taking tips and time management
- Subject-specific preparation advice

📊 **Progress Tracking**
- Session summaries
- Accuracy tracking
- Performance analytics
- Personalized study recommendations

🤖 **AI-Powered Features**
- Interactive tutoring sessions
- Instant feedback on answers
- Contextual hints
- Adaptive learning support

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ccrabt87/miniature-palm-tree.git
cd miniature-palm-tree
```

2. Ensure Python 3.7+ is installed:
```bash
python --version
```

3. (Optional) Install additional dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

Run the tutor agent directly:

```bash
python k12_tutor.py
```

This will run a demonstration showing:
- Starting a tutoring session
- Asking practice questions
- Providing study tips
- Test preparation guidance
- Session summaries

### Programmatic Usage

```python
from k12_tutor import K12TutorAgent, TutorModal, GradeLevel, Subject

# Create a tutor instance
tutor = K12TutorAgent()

# Start a session
session_msg = tutor.start_session(
    student_name="John",
    grade_level=GradeLevel.FIFTH,
    subject=Subject.MATH
)
print(session_msg)

# Get a practice question
question = tutor.ask_question("math_elementary")

# Check student's answer
result = tutor.check_answer(question, "12")
print(result["feedback"])

# Get study tips
tips = tutor.get_study_tips(Subject.MATH, GradeLevel.FIFTH)
for tip in tips:
    print(f"- {tip}")

# View session summary
summary = tutor.get_session_summary()
print(summary)
```

### Using the Modal Interface

```python
from k12_tutor import TutorModal

# Create and open the modal
modal = TutorModal()
print(modal.open_modal())

# The modal provides an interactive menu-driven interface
# Students can:
# 1. Start new tutoring sessions
# 2. Practice questions
# 3. Get concept explanations
# 4. Access test preparation materials
# 5. View progress summaries
# 6. Get subject-specific study tips
```

## Core Components

### K12TutorAgent

The main tutoring agent class that provides:
- Session management
- Question generation and validation
- Answer checking with feedback
- Concept explanations
- Study tips and test preparation guidance

### TutorModal

An interactive modal interface that provides:
- User-friendly menu system
- Visual formatting for questions and feedback
- Progress tracking displays
- Welcome and exit screens

### Grade Levels

Supports all K-12 grade levels:
- Elementary: K-5
- Middle School: 6-8
- High School: 9-12

### Subjects

All major K-12 subjects:
- Core: Math, Science, English, History, Reading, Writing
- Advanced: Algebra, Geometry, Calculus, Biology, Chemistry, Physics

### Difficulty Levels

- Beginner: Foundation concepts
- Intermediate: Standard grade-level content
- Advanced: Challenge problems
- Test Prep: Test-specific practice

## Examples

### Starting a Math Session

```python
tutor = K12TutorAgent()
tutor.start_session("Sarah", GradeLevel.SEVENTH, Subject.ALGEBRA)
question = tutor.ask_question("math_middle")
```

### Getting Help with Concepts

```python
explanation = tutor.explain_concept("fractions", GradeLevel.THIRD)
print(explanation)
```

### Test Preparation

```python
prep_guide = tutor.prepare_for_test("State Math Test", GradeLevel.EIGHTH)
print(prep_guide)
```

### Tracking Progress

```python
# After answering several questions
summary = tutor.get_session_summary()
print(summary)
# Shows: questions answered, accuracy rate, encouragement
```

## Extending the Tutor

### Adding New Questions

Add questions to the question bank in `_initialize_question_bank()`:

```python
Question(
    question_text="Your question here?",
    subject=Subject.MATH,
    grade_level=GradeLevel.SIXTH,
    difficulty=DifficultyLevel.INTERMEDIATE,
    correct_answer="The answer",
    explanation="Detailed explanation of the concept",
    hints=["Hint 1", "Hint 2"]
)
```

### Adding New Subjects

Extend the `Subject` enum:

```python
class Subject(Enum):
    # ... existing subjects ...
    COMPUTER_SCIENCE = "Computer Science"
    ART = "Art"
```

### Customizing Explanations

Add explanations in the `explain_concept()` method:

```python
explanations = {
    "your_topic": {
        GradeLevel.FIFTH: "Grade 5 explanation",
        GradeLevel.EIGHTH: "Grade 8 explanation",
    }
}
```

## Educational Approach

This tutor follows evidence-based educational practices:

1. **Immediate Feedback**: Students receive instant feedback on answers
2. **Scaffolded Learning**: Hints provided to guide thinking
3. **Explanation-Based**: Detailed explanations help understanding
4. **Positive Reinforcement**: Encouraging messages boost confidence
5. **Progress Tracking**: Students can see their improvement
6. **Adaptive Content**: Questions match grade level and subject

## Test Preparation Features

The tutor includes comprehensive test prep support:

- **Study Schedules**: Recommended preparation timelines
- **Test-Taking Strategies**: Time management and approach
- **Subject-Specific Tips**: Tailored advice for each subject
- **Practice Questions**: Test-format question practice
- **Confidence Building**: Positive messaging and encouragement

## Future Enhancements

Potential additions:
- Integration with AI APIs (OpenAI, Anthropic) for dynamic content
- Web interface using Flask or Streamlit
- Database integration for persistent progress tracking
- Multi-language support
- Parent/teacher dashboard
- Gamification elements
- Collaborative study features
- Video explanations
- Mobile app version

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for:
- New question content
- Additional subjects
- Enhanced explanations
- Bug fixes
- Feature requests

## License

This project is open source and available for educational purposes.

## Support

For questions or support, please open an issue on GitHub.

---

**Made with ❤️ for K-12 students everywhere. Happy learning! 🌟**