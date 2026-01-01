"""
Interactive K-12 Tutor Example
This script demonstrates an interactive tutoring session
"""

from k12_tutor import K12TutorAgent, TutorModal, GradeLevel, Subject


def interactive_session():
    """Run an interactive tutoring session"""
    
    modal = TutorModal()
    tutor = modal.tutor
    
    print(modal.display_welcome())
    print("\n")
    
    # Get student information
    print("Let's get started! First, tell me about yourself.\n")
    
    student_name = input("What's your name? ").strip() or "Student"
    
    print(modal.get_grade_selection())
    grade_input = input().strip() or "5"
    
    # Map grade input to GradeLevel
    grade_map = {
        "K": GradeLevel.KINDERGARTEN,
        "1": GradeLevel.FIRST,
        "2": GradeLevel.SECOND,
        "3": GradeLevel.THIRD,
        "4": GradeLevel.FOURTH,
        "5": GradeLevel.FIFTH,
        "6": GradeLevel.SIXTH,
        "7": GradeLevel.SEVENTH,
        "8": GradeLevel.EIGHTH,
        "9": GradeLevel.NINTH,
        "10": GradeLevel.TENTH,
        "11": GradeLevel.ELEVENTH,
        "12": GradeLevel.TWELFTH,
    }
    
    grade_level = grade_map.get(grade_input, GradeLevel.FIFTH)
    
    print(modal.get_subject_selection())
    subject_input = input().strip() or "1"
    
    # Map subject input to Subject
    subject_map = {
        "1": Subject.MATH,
        "2": Subject.SCIENCE,
        "3": Subject.ENGLISH,
        "4": Subject.HISTORY,
        "5": Subject.READING,
        "6": Subject.WRITING,
        "7": Subject.ALGEBRA,
        "8": Subject.GEOMETRY,
        "9": Subject.CALCULUS,
        "10": Subject.BIOLOGY,
        "11": Subject.CHEMISTRY,
        "12": Subject.PHYSICS,
    }
    
    subject = subject_map.get(subject_input, Subject.MATH)
    
    # Start session
    print("\n" + tutor.start_session(student_name, grade_level, subject))
    
    # Main interaction loop
    while True:
        print("\n" + modal.display_menu())
        choice = input().strip()
        
        if choice == "1":
            # Start new session
            print("\nGreat! Starting a new session...")
            print(modal.get_subject_selection())
            subject_input = input().strip() or "1"
            subject = subject_map.get(subject_input, Subject.MATH)
            print("\n" + tutor.start_session(student_name, grade_level, subject))
            
        elif choice == "2":
            # Practice questions
            print("\n🎯 Practice Time!\n")
            question = tutor.ask_question("math_elementary")
            
            if question:
                print(modal.format_question(question))
                answer = input().strip()
                
                if answer.lower() == "hint":
                    print(tutor.get_hint(question, 0))
                    print("\nTry again!")
                    answer = input("Your answer: ").strip()
                
                result = tutor.check_answer(question, answer)
                print("\n" + result["feedback"])
            else:
                print("No questions available for this category.")
                
        elif choice == "3":
            # Explain a concept
            print("\n📖 Concept Explanation\n")
            print("Which topic would you like me to explain?")
            print("Examples: fractions, photosynthesis, grammar")
            topic = input("\nTopic: ").strip() or "fractions"
            
            explanation = tutor.explain_concept(topic, grade_level)
            print(f"\n{explanation}\n")
            
        elif choice == "4":
            # Test preparation
            print("\n🎯 Test Preparation\n")
            test_type = input("What test are you preparing for? ").strip() or "Math Test"
            
            prep_guide = tutor.prepare_for_test(test_type, grade_level)
            print("\n" + prep_guide)
            
        elif choice == "5":
            # View session summary
            summary = tutor.get_session_summary()
            print("\n" + summary)
            
        elif choice == "6":
            # Get study tips
            tips = tutor.get_study_tips(subject, grade_level)
            print(f"\n📝 Study Tips for {subject.value}:\n")
            for i, tip in enumerate(tips, 1):
                print(f"  {i}. {tip}")
            print()
            
        elif choice == "7":
            # Exit
            print("\n" + modal.close_modal())
            break
            
        else:
            print("\n⚠️  Invalid choice. Please select 1-7.")
    

def quick_practice_session():
    """Quick practice session with predefined settings"""
    
    print("🚀 Quick Practice Mode\n")
    
    tutor = K12TutorAgent()
    tutor.start_session("Quick Learner", GradeLevel.FIFTH, Subject.MATH)
    
    # Ask 3 questions
    categories = ["math_elementary", "math_elementary", "science"]
    sample_answers = ["12", "96", "Solid, Liquid, and Gas"]
    
    for i, (category, sample_ans) in enumerate(zip(categories, sample_answers), 1):
        print(f"\n{'='*60}")
        print(f"Question {i}/3")
        print('='*60)
        
        question = tutor.ask_question(category)
        if question:
            print(f"\n{question.question_text}")
            print(f"\nSample Answer: {sample_ans}")
            
            result = tutor.check_answer(question, sample_ans)
            print(result["feedback"])
    
    # Show summary
    print("\n" + "="*60)
    print(tutor.get_session_summary())


def demonstrate_all_features():
    """Demonstrate all tutor features"""
    
    print("🎓 K-12 Tutor Feature Demonstration\n")
    
    tutor = K12TutorAgent()
    modal = TutorModal()
    
    # Feature 1: Starting a session
    print("\n1️⃣  Starting a Session")
    print("-" * 60)
    session_msg = tutor.start_session("Demo Student", GradeLevel.SIXTH, Subject.SCIENCE)
    print(session_msg)
    
    # Feature 2: Getting questions
    print("\n2️⃣  Practice Questions")
    print("-" * 60)
    question = tutor.ask_question("science")
    if question:
        print(f"Q: {question.question_text}")
        print(f"A: {question.correct_answer}")
        print(f"Explanation: {question.explanation}")
    
    # Feature 3: Checking answers
    print("\n3️⃣  Checking Answers")
    print("-" * 60)
    result = tutor.check_answer(question, question.correct_answer)
    print(result["feedback"])
    
    # Feature 4: Getting hints
    print("\n4️⃣  Getting Hints")
    print("-" * 60)
    hint = tutor.get_hint(question, 0)
    print(hint)
    
    # Feature 5: Explaining concepts
    print("\n5️⃣  Concept Explanations")
    print("-" * 60)
    explanation = tutor.explain_concept("photosynthesis", GradeLevel.FIFTH)
    print(explanation)
    
    # Feature 6: Study tips
    print("\n6️⃣  Study Tips")
    print("-" * 60)
    tips = tutor.get_study_tips(Subject.SCIENCE, GradeLevel.SIXTH)
    for i, tip in enumerate(tips, 1):
        print(f"{i}. {tip}")
    
    # Feature 7: Test preparation
    print("\n7️⃣  Test Preparation")
    print("-" * 60)
    prep = tutor.prepare_for_test("Science Exam", GradeLevel.SIXTH)
    print(prep)
    
    # Feature 8: Session summary
    print("\n8️⃣  Session Summary")
    print("-" * 60)
    summary = tutor.get_session_summary()
    print(summary)
    
    # Feature 9: Modal interface
    print("\n9️⃣  Modal Interface")
    print("-" * 60)
    print(modal.display_welcome())
    print("\nMenu Options:")
    print(modal.display_menu())


if __name__ == "__main__":
    import sys
    
    print("="*60)
    print("K-12 AI Tutoring Agent - Examples")
    print("="*60)
    print("\nChoose a mode:")
    print("1. Interactive Session (full experience)")
    print("2. Quick Practice (3 questions)")
    print("3. Feature Demonstration (show all features)")
    print("4. Exit")
    print()
    
    if len(sys.argv) > 1:
        mode = sys.argv[1]
    else:
        mode = input("Enter choice (1-4): ").strip() or "3"
    
    if mode == "1":
        interactive_session()
    elif mode == "2":
        quick_practice_session()
    elif mode == "3":
        demonstrate_all_features()
    else:
        print("Goodbye! 👋")
