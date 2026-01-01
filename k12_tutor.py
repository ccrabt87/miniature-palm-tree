"""
K-12 AI Tutoring Agent
A comprehensive AI-powered tutor for K-12 students covering all major subjects
and test preparation.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class GradeLevel(Enum):
    """Grade levels from Kindergarten to 12th grade"""
    KINDERGARTEN = "K"
    FIRST = "1"
    SECOND = "2"
    THIRD = "3"
    FOURTH = "4"
    FIFTH = "5"
    SIXTH = "6"
    SEVENTH = "7"
    EIGHTH = "8"
    NINTH = "9"
    TENTH = "10"
    ELEVENTH = "11"
    TWELFTH = "12"


class Subject(Enum):
    """Core K-12 subjects"""
    MATH = "Mathematics"
    SCIENCE = "Science"
    ENGLISH = "English/Language Arts"
    HISTORY = "History/Social Studies"
    READING = "Reading"
    WRITING = "Writing"
    GEOGRAPHY = "Geography"
    BIOLOGY = "Biology"
    CHEMISTRY = "Chemistry"
    PHYSICS = "Physics"
    ALGEBRA = "Algebra"
    GEOMETRY = "Geometry"
    CALCULUS = "Calculus"


class DifficultyLevel(Enum):
    """Difficulty levels for questions and content"""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    TEST_PREP = "test_prep"


@dataclass
class TutoringSession:
    """Represents a tutoring session"""
    student_name: str
    grade_level: GradeLevel
    subject: Subject
    topics: List[str] = field(default_factory=list)
    questions_asked: int = 0
    correct_answers: int = 0
    session_notes: List[str] = field(default_factory=list)


@dataclass
class Question:
    """Represents a tutoring question"""
    question_text: str
    subject: Subject
    grade_level: GradeLevel
    difficulty: DifficultyLevel
    correct_answer: str
    explanation: str
    hints: List[str] = field(default_factory=list)


class K12TutorAgent:
    """
    AI Tutoring Agent for K-12 Education
    
    This agent provides:
    - Subject-specific tutoring across all K-12 grades
    - Test preparation guidance
    - Personalized learning assistance
    - Progress tracking
    """
    
    def __init__(self):
        self.current_session: Optional[TutoringSession] = None
        self.question_bank = self._initialize_question_bank()
        
    def _initialize_question_bank(self) -> Dict[str, List[Question]]:
        """Initialize a sample question bank for different subjects and grades"""
        return {
            "math_elementary": [
                Question(
                    question_text="What is 5 + 7?",
                    subject=Subject.MATH,
                    grade_level=GradeLevel.FIRST,
                    difficulty=DifficultyLevel.BEGINNER,
                    correct_answer="12",
                    explanation="When you add 5 and 7, you get 12. You can count on your fingers or use objects to verify!",
                    hints=["Start with 5 and count up 7 more", "Think: 5 + 5 = 10, then add 2 more"]
                ),
                Question(
                    question_text="What is 12 × 8?",
                    subject=Subject.MATH,
                    grade_level=GradeLevel.FOURTH,
                    difficulty=DifficultyLevel.INTERMEDIATE,
                    correct_answer="96",
                    explanation="12 × 8 = 96. You can think of it as (10 × 8) + (2 × 8) = 80 + 16 = 96",
                    hints=["Break it down: 10 × 8 plus 2 × 8", "Use the distributive property"]
                ),
            ],
            "math_middle": [
                Question(
                    question_text="Solve for x: 2x + 5 = 15",
                    subject=Subject.ALGEBRA,
                    grade_level=GradeLevel.SEVENTH,
                    difficulty=DifficultyLevel.INTERMEDIATE,
                    correct_answer="x = 5",
                    explanation="Subtract 5 from both sides: 2x = 10. Then divide by 2: x = 5",
                    hints=["First, isolate the term with x", "What operation is the opposite of adding 5?"]
                ),
            ],
            "math_high": [
                Question(
                    question_text="What is the derivative of f(x) = 3x² + 2x - 1?",
                    subject=Subject.CALCULUS,
                    grade_level=GradeLevel.TWELFTH,
                    difficulty=DifficultyLevel.ADVANCED,
                    correct_answer="f'(x) = 6x + 2",
                    explanation="Using the power rule: d/dx(3x²) = 6x, d/dx(2x) = 2, d/dx(-1) = 0",
                    hints=["Apply the power rule to each term", "Remember: d/dx(x^n) = n·x^(n-1)"]
                ),
            ],
            "science": [
                Question(
                    question_text="What are the three states of matter?",
                    subject=Subject.SCIENCE,
                    grade_level=GradeLevel.THIRD,
                    difficulty=DifficultyLevel.BEGINNER,
                    correct_answer="Solid, Liquid, and Gas",
                    explanation="Matter exists in three main states: solid (fixed shape), liquid (takes container shape), and gas (fills container).",
                    hints=["Think about ice, water, and steam", "Think about how things can change form"]
                ),
            ],
            "english": [
                Question(
                    question_text="What is a noun?",
                    subject=Subject.ENGLISH,
                    grade_level=GradeLevel.SECOND,
                    difficulty=DifficultyLevel.BEGINNER,
                    correct_answer="A person, place, thing, or idea",
                    explanation="A noun is a word that names a person (teacher), place (school), thing (book), or idea (happiness).",
                    hints=["Think of words that name things", "Examples: dog, house, love"]
                ),
            ],
        }
    
    def start_session(self, student_name: str, grade_level: GradeLevel, subject: Subject) -> str:
        """Start a new tutoring session"""
        self.current_session = TutoringSession(
            student_name=student_name,
            grade_level=grade_level,
            subject=subject
        )
        
        return f"""
🎓 Welcome to K-12 AI Tutor, {student_name}! 🎓

Grade Level: {grade_level.value}
Subject: {subject.value}

I'm here to help you learn and prepare for your tests. 
Let me know what topics you'd like to cover, or I can quiz you to assess your knowledge!

What would you like to work on today?
"""
    
    def ask_question(self, category: str = "math_elementary") -> Optional[Question]:
        """Get a question from the question bank"""
        if category in self.question_bank and self.question_bank[category]:
            # In a real implementation, this would select based on student level
            return self.question_bank[category][0]
        return None
    
    def check_answer(self, question: Question, student_answer: str) -> Dict[str, any]:
        """Check if student's answer is correct and provide feedback"""
        if not self.current_session:
            return {"error": "No active session"}
        
        self.current_session.questions_asked += 1
        
        # Normalize answers for comparison
        correct = question.correct_answer.strip().lower()
        student = student_answer.strip().lower()
        
        is_correct = correct == student
        
        if is_correct:
            self.current_session.correct_answers += 1
            feedback = f"""
✅ Correct! Great job!

{question.explanation}

Keep up the excellent work! 🌟
"""
        else:
            feedback = f"""
❌ Not quite right. The correct answer is: {question.correct_answer}

{question.explanation}

Don't worry! Learning from mistakes is part of the process. Let's try another one! 💪
"""
        
        return {
            "is_correct": is_correct,
            "feedback": feedback,
            "hints_available": question.hints
        }
    
    def get_hint(self, question: Question, hint_index: int = 0) -> str:
        """Provide a hint for the current question"""
        if hint_index < len(question.hints):
            return f"💡 Hint: {question.hints[hint_index]}"
        return "No more hints available. Try your best!"
    
    def explain_concept(self, topic: str, grade_level: GradeLevel) -> str:
        """Provide an explanation of a concept"""
        # Sample explanations - in a real system, this would be comprehensive
        explanations = {
            "fractions": {
                GradeLevel.THIRD: "A fraction represents a part of a whole. The top number (numerator) tells how many parts you have, and the bottom number (denominator) tells how many equal parts the whole is divided into.",
                GradeLevel.FIFTH: "Fractions can be added, subtracted, multiplied, and divided. To add fractions, you need a common denominator. For example, 1/2 + 1/4 = 2/4 + 1/4 = 3/4.",
            },
            "photosynthesis": {
                GradeLevel.FIFTH: "Photosynthesis is how plants make their own food using sunlight, water, and carbon dioxide. The formula is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂",
            },
            "grammar": {
                GradeLevel.THIRD: "A sentence needs a subject (who or what) and a verb (action or being). For example: 'The dog runs.' - 'dog' is the subject and 'runs' is the verb.",
            }
        }
        
        if topic in explanations and grade_level in explanations[topic]:
            return explanations[topic][grade_level]
        
        return f"I'd be happy to explain {topic}! This is an important concept for {grade_level.value} grade students."
    
    def get_session_summary(self) -> str:
        """Get a summary of the current session"""
        if not self.current_session:
            return "No active session"
        
        accuracy = 0
        if self.current_session.questions_asked > 0:
            accuracy = (self.current_session.correct_answers / self.current_session.questions_asked) * 100
        
        return f"""
📊 Session Summary for {self.current_session.student_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Grade Level: {self.current_session.grade_level.value}
Subject: {self.current_session.subject.value}

Questions Answered: {self.current_session.questions_asked}
Correct Answers: {self.current_session.correct_answers}
Accuracy: {accuracy:.1f}%

{"🏆 Excellent work!" if accuracy >= 80 else "📚 Keep practicing! You're making progress!"}
"""
    
    def get_study_tips(self, subject: Subject, grade_level: GradeLevel) -> List[str]:
        """Provide study tips for specific subjects and grade levels"""
        tips = {
            Subject.MATH: [
                "Practice problems daily - consistency is key!",
                "Show your work step-by-step to avoid mistakes",
                "Check your answers by working backwards",
                "Use visual aids like diagrams or graphs when possible",
            ],
            Subject.SCIENCE: [
                "Create flashcards for important terms and concepts",
                "Draw diagrams to visualize processes",
                "Relate concepts to real-world examples",
                "Do hands-on experiments when possible",
            ],
            Subject.ENGLISH: [
                "Read for at least 20 minutes every day",
                "Keep a vocabulary journal",
                "Practice writing in different styles",
                "Read your work aloud to catch errors",
            ],
        }
        
        return tips.get(subject, ["Study regularly", "Ask questions when confused", "Practice makes perfect!"])
    
    def prepare_for_test(self, test_type: str, grade_level: GradeLevel) -> str:
        """Provide test preparation guidance"""
        prep_guide = f"""
🎯 Test Preparation Guide
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test Type: {test_type}
Grade Level: {grade_level.value}

General Test-Taking Strategies:
1. Read all instructions carefully before starting
2. Answer easy questions first, then return to harder ones
3. Manage your time - don't spend too long on one question
4. Check your work if time permits
5. Stay calm and confident!

Study Schedule Recommendation:
- 2 weeks before: Review all major topics
- 1 week before: Focus on weak areas, practice problems
- 3 days before: Take practice tests
- 1 day before: Light review, rest well
- Test day: Eat a good breakfast, arrive early, stay positive!

Remember: Preparation and a positive attitude are your best tools! 💪
"""
        return prep_guide


class TutorModal:
    """
    Interactive modal interface for the K-12 Tutor Agent
    This provides a user-friendly interface for students to interact with the tutor
    """
    
    def __init__(self):
        self.tutor = K12TutorAgent()
        self.active = False
        
    def display_welcome(self) -> str:
        """Display welcome screen"""
        return """
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         🎓 K-12 AI TUTORING AGENT 🎓                     ║
║                                                           ║
║     Your Personal AI Tutor for Academic Success!         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

Features:
✓ Personalized tutoring for grades K-12
✓ All major subjects covered
✓ Test preparation assistance
✓ Progress tracking
✓ Instant feedback and explanations
✓ Adaptive learning support

Let's start your learning journey!
"""
    
    def display_menu(self) -> str:
        """Display main menu options"""
        return """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Main Menu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Start New Tutoring Session
2. Practice Questions
3. Explain a Concept
4. Test Preparation
5. View Session Summary
6. Get Study Tips
7. Exit

Choose an option (1-7):
"""
    
    def get_grade_selection(self) -> str:
        """Display grade level selection"""
        return """
Select Your Grade Level:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Elementary School:
  K - Kindergarten    1 - First Grade     2 - Second Grade
  3 - Third Grade     4 - Fourth Grade    5 - Fifth Grade

Middle School:
  6 - Sixth Grade     7 - Seventh Grade   8 - Eighth Grade

High School:
  9 - Ninth Grade     10 - Tenth Grade
  11 - Eleventh Grade 12 - Twelfth Grade

Enter your grade level:
"""
    
    def get_subject_selection(self) -> str:
        """Display subject selection"""
        return """
Select a Subject:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Core Subjects:
  1. Mathematics           2. Science
  3. English/Language Arts 4. History/Social Studies
  5. Reading              6. Writing

Advanced Subjects (High School):
  7. Algebra    8. Geometry    9. Calculus
  10. Biology   11. Chemistry  12. Physics

Enter subject number:
"""
    
    def show_progress_bar(self, current: int, total: int) -> str:
        """Display a progress bar"""
        percentage = (current / total) * 100 if total > 0 else 0
        filled = int(percentage / 5)
        bar = "█" * filled + "░" * (20 - filled)
        return f"Progress: [{bar}] {percentage:.0f}% ({current}/{total})"
    
    def format_question(self, question: Question) -> str:
        """Format a question for display"""
        return f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Question
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject: {question.subject.value}
Grade Level: {question.grade_level.value}
Difficulty: {question.difficulty.value}

{question.question_text}

Your answer:
"""
    
    def open_modal(self) -> str:
        """Open the tutor modal"""
        self.active = True
        return self.display_welcome() + "\n" + self.display_menu()
    
    def close_modal(self) -> str:
        """Close the tutor modal"""
        self.active = False
        return """
Thank you for using K-12 AI Tutor! 👋

Remember:
• Practice makes perfect
• Every mistake is a learning opportunity
• Stay curious and keep learning!

See you next time! 📚✨
"""


# Example usage and demonstration
def main():
    """Main function to demonstrate the K-12 Tutor Agent"""
    
    # Create tutor modal
    modal = TutorModal()
    tutor = modal.tutor
    
    # Display welcome
    print(modal.display_welcome())
    
    # Start a sample session
    print("\n" + "="*60)
    print("DEMO: Starting a tutoring session")
    print("="*60)
    
    session_start = tutor.start_session(
        student_name="Alex",
        grade_level=GradeLevel.FOURTH,
        subject=Subject.MATH
    )
    print(session_start)
    
    # Ask a question
    print("\n" + "="*60)
    print("DEMO: Practice Question")
    print("="*60)
    
    question = tutor.ask_question("math_elementary")
    if question:
        print(modal.format_question(question))
        
        # Simulate student answer
        print("Student answers: 12")
        result = tutor.check_answer(question, "12")
        print(result["feedback"])
    
    # Show study tips
    print("\n" + "="*60)
    print("DEMO: Study Tips")
    print("="*60)
    
    tips = tutor.get_study_tips(Subject.MATH, GradeLevel.FOURTH)
    print("\n📝 Study Tips for Mathematics:")
    for i, tip in enumerate(tips, 1):
        print(f"  {i}. {tip}")
    
    # Show test prep guide
    print("\n" + "="*60)
    print("DEMO: Test Preparation")
    print("="*60)
    
    prep_guide = tutor.prepare_for_test("Math Quiz", GradeLevel.FOURTH)
    print(prep_guide)
    
    # Show session summary
    print("\n" + "="*60)
    print("DEMO: Session Summary")
    print("="*60)
    
    summary = tutor.get_session_summary()
    print(summary)
    
    # Close modal
    print("\n" + modal.close_modal())


if __name__ == "__main__":
    main()
