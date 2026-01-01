"""
Tests for K-12 Tutoring Agent
Simple tests to validate core functionality
"""

from k12_tutor import (
    K12TutorAgent, TutorModal, GradeLevel, Subject, 
    DifficultyLevel, Question, TutoringSession
)


def test_tutor_initialization():
    """Test that tutor initializes correctly"""
    tutor = K12TutorAgent()
    assert tutor.current_session is None
    assert tutor.question_bank is not None
    assert len(tutor.question_bank) > 0
    print("✓ Tutor initialization test passed")


def test_start_session():
    """Test starting a tutoring session"""
    tutor = K12TutorAgent()
    result = tutor.start_session("Test Student", GradeLevel.FIFTH, Subject.MATH)
    
    assert tutor.current_session is not None
    assert tutor.current_session.student_name == "Test Student"
    assert tutor.current_session.grade_level == GradeLevel.FIFTH
    assert tutor.current_session.subject == Subject.MATH
    assert "Test Student" in result
    print("✓ Start session test passed")


def test_question_retrieval():
    """Test getting questions from the bank"""
    tutor = K12TutorAgent()
    tutor.start_session("Test", GradeLevel.THIRD, Subject.MATH)
    
    question = tutor.ask_question("math_elementary")
    assert question is not None
    assert isinstance(question, Question)
    assert question.question_text != ""
    assert question.correct_answer != ""
    print("✓ Question retrieval test passed")


def test_answer_checking_correct():
    """Test checking a correct answer"""
    tutor = K12TutorAgent()
    tutor.start_session("Test", GradeLevel.FIRST, Subject.MATH)
    
    question = tutor.ask_question("math_elementary")
    result = tutor.check_answer(question, question.correct_answer)
    
    assert result["is_correct"] == True
    assert tutor.current_session.questions_asked == 1
    assert tutor.current_session.correct_answers == 1
    print("✓ Correct answer checking test passed")


def test_answer_checking_incorrect():
    """Test checking an incorrect answer"""
    tutor = K12TutorAgent()
    tutor.start_session("Test", GradeLevel.FIRST, Subject.MATH)
    
    question = tutor.ask_question("math_elementary")
    result = tutor.check_answer(question, "wrong answer")
    
    assert result["is_correct"] == False
    assert tutor.current_session.questions_asked == 1
    assert tutor.current_session.correct_answers == 0
    print("✓ Incorrect answer checking test passed")


def test_hints():
    """Test hint retrieval"""
    tutor = K12TutorAgent()
    question = tutor.ask_question("math_elementary")
    
    hint = tutor.get_hint(question, 0)
    assert hint is not None
    assert "Hint" in hint or "hint" in hint.lower()
    print("✓ Hint test passed")


def test_study_tips():
    """Test study tips retrieval"""
    tutor = K12TutorAgent()
    tips = tutor.get_study_tips(Subject.MATH, GradeLevel.FIFTH)
    
    assert tips is not None
    assert len(tips) > 0
    assert all(isinstance(tip, str) for tip in tips)
    print("✓ Study tips test passed")


def test_test_preparation():
    """Test test preparation guide"""
    tutor = K12TutorAgent()
    prep = tutor.prepare_for_test("Math Test", GradeLevel.SIXTH)
    
    assert prep is not None
    assert "Math Test" in prep
    assert "SIXTH" in prep or "6" in prep
    print("✓ Test preparation test passed")


def test_session_summary():
    """Test session summary generation"""
    tutor = K12TutorAgent()
    tutor.start_session("Test", GradeLevel.FOURTH, Subject.MATH)
    
    # Answer some questions
    question = tutor.ask_question("math_elementary")
    tutor.check_answer(question, question.correct_answer)
    
    summary = tutor.get_session_summary()
    assert summary is not None
    assert "Test" in summary
    assert "1" in summary  # Should show 1 question asked
    print("✓ Session summary test passed")


def test_concept_explanation():
    """Test concept explanation"""
    tutor = K12TutorAgent()
    explanation = tutor.explain_concept("fractions", GradeLevel.THIRD)
    
    assert explanation is not None
    assert len(explanation) > 0
    print("✓ Concept explanation test passed")


def test_modal_initialization():
    """Test modal initialization"""
    modal = TutorModal()
    assert modal.tutor is not None
    assert modal.active == False
    print("✓ Modal initialization test passed")


def test_modal_display():
    """Test modal display methods"""
    modal = TutorModal()
    
    welcome = modal.display_welcome()
    assert "K-12" in welcome or "Tutor" in welcome
    
    menu = modal.display_menu()
    assert "1." in menu
    
    grade_sel = modal.get_grade_selection()
    assert "Grade" in grade_sel or "grade" in grade_sel
    
    subject_sel = modal.get_subject_selection()
    assert "Subject" in subject_sel or "subject" in subject_sel
    
    print("✓ Modal display test passed")


def test_modal_open_close():
    """Test opening and closing modal"""
    modal = TutorModal()
    
    open_msg = modal.open_modal()
    assert modal.active == True
    assert len(open_msg) > 0
    
    close_msg = modal.close_modal()
    assert modal.active == False
    assert len(close_msg) > 0
    
    print("✓ Modal open/close test passed")


def test_grade_levels():
    """Test that all grade levels are defined"""
    grades = [
        GradeLevel.KINDERGARTEN, GradeLevel.FIRST, GradeLevel.SECOND,
        GradeLevel.THIRD, GradeLevel.FOURTH, GradeLevel.FIFTH,
        GradeLevel.SIXTH, GradeLevel.SEVENTH, GradeLevel.EIGHTH,
        GradeLevel.NINTH, GradeLevel.TENTH, GradeLevel.ELEVENTH,
        GradeLevel.TWELFTH
    ]
    assert len(grades) == 13
    print("✓ Grade levels test passed")


def test_subjects():
    """Test that subjects are defined"""
    subjects = [
        Subject.MATH, Subject.SCIENCE, Subject.ENGLISH,
        Subject.HISTORY, Subject.READING, Subject.WRITING,
        Subject.ALGEBRA, Subject.GEOMETRY, Subject.CALCULUS,
        Subject.BIOLOGY, Subject.CHEMISTRY, Subject.PHYSICS
    ]
    assert len(subjects) >= 12
    print("✓ Subjects test passed")


def test_difficulty_levels():
    """Test difficulty levels"""
    levels = [
        DifficultyLevel.BEGINNER,
        DifficultyLevel.INTERMEDIATE,
        DifficultyLevel.ADVANCED,
        DifficultyLevel.TEST_PREP
    ]
    assert len(levels) == 4
    print("✓ Difficulty levels test passed")


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("Running K-12 Tutor Agent Tests")
    print("="*60 + "\n")
    
    tests = [
        test_tutor_initialization,
        test_start_session,
        test_question_retrieval,
        test_answer_checking_correct,
        test_answer_checking_incorrect,
        test_hints,
        test_study_tips,
        test_test_preparation,
        test_session_summary,
        test_concept_explanation,
        test_modal_initialization,
        test_modal_display,
        test_modal_open_close,
        test_grade_levels,
        test_subjects,
        test_difficulty_levels,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ {test.__name__} failed: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test.__name__} error: {e}")
            failed += 1
    
    print("\n" + "="*60)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("="*60 + "\n")
    
    if failed == 0:
        print("🎉 All tests passed! 🎉\n")
        return 0
    else:
        print(f"⚠️  {failed} test(s) failed\n")
        return 1


if __name__ == "__main__":
    exit(run_all_tests())
