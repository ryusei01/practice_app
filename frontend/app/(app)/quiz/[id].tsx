import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import { questionsApi, Question } from '../../../src/api/questions';
import { answersApi } from '../../../src/api/answers';

type QuestionType = 'multiple_choice' | 'true_false' | 'text_input';

export default function QuizScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [sessionId] = useState<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  useEffect(() => {
    if (id && user) {
      loadQuestions();
    }
  }, [id, user]);

  const loadQuestions = async () => {
    try {
      const data = await questionsApi.getAll({ question_set_id: id as string });
      if (data.length === 0) {
        Alert.alert('No Questions', 'This question set has no questions yet.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setQuestions(data);
      setStartTime(Date.now());
    } catch (error) {
      console.error('Failed to load questions:', error);
      Alert.alert('Error', 'Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAnswer = (answer: string): boolean => {
    const currentQuestion = questions[currentQuestionIndex];
    const correctAnswer = currentQuestion.correct_answer.trim().toLowerCase();
    const userAnswerLower = answer.trim().toLowerCase();

    if (currentQuestion.question_type === 'multiple_choice') {
      return userAnswerLower === correctAnswer;
    } else if (currentQuestion.question_type === 'true_false') {
      return userAnswerLower === correctAnswer;
    } else {
      // For text input, check if answers match (case-insensitive)
      return userAnswerLower === correctAnswer;
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      Alert.alert('Error', 'Please provide an answer');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit answers');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentQuestion = questions[currentQuestionIndex];
      const answerTimeSec = Math.floor((Date.now() - startTime) / 1000);
      const correct = checkAnswer(userAnswer);

      await answersApi.submitAnswer({
        user_id: user.id,
        question_id: currentQuestion.id,
        user_answer: userAnswer,
        is_correct: correct,
        answer_time_sec: answerTimeSec,
        session_id: sessionId,
      });

      setIsCorrect(correct);
      setShowResult(true);
      setTotalAnswered(totalAnswered + 1);
      if (correct) {
        setScore(score + 1);
      }
    } catch (error: any) {
      console.error('Failed to submit answer:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer('');
      setShowResult(false);
      setStartTime(Date.now());
    } else {
      // Quiz completed
      Alert.alert(
        'Quiz Completed!',
        `Your Score: ${score}/${totalAnswered}\nAccuracy: ${((score / totalAnswered) * 100).toFixed(1)}%`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  const renderAnswerInput = () => {
    const currentQuestion = questions[currentQuestionIndex];

    if (currentQuestion.question_type === 'multiple_choice' && currentQuestion.options) {
      return (
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                userAnswer === option && styles.optionButtonSelected,
              ]}
              onPress={() => setUserAnswer(option)}
              disabled={showResult}
            >
              <Text
                style={[
                  styles.optionText,
                  userAnswer === option && styles.optionTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    } else if (currentQuestion.question_type === 'true_false') {
      return (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              userAnswer === 'true' && styles.optionButtonSelected,
            ]}
            onPress={() => setUserAnswer('true')}
            disabled={showResult}
          >
            <Text
              style={[
                styles.optionText,
                userAnswer === 'true' && styles.optionTextSelected,
              ]}
            >
              True
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionButton,
              userAnswer === 'false' && styles.optionButtonSelected,
            ]}
            onPress={() => setUserAnswer('false')}
            disabled={showResult}
          >
            <Text
              style={[
                styles.optionText,
                userAnswer === 'false' && styles.optionTextSelected,
              ]}
            >
              False
            </Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <TextInput
          style={styles.textInput}
          placeholder="Enter your answer"
          value={userAnswer}
          onChangeText={setUserAnswer}
          editable={!showResult}
          multiline
        />
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No questions available</Text>
      </View>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progressText}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </Text>
        <Text style={styles.scoreText}>
          Score: {score}/{totalAnswered}
        </Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

        {currentQuestion.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{currentQuestion.category}</Text>
          </View>
        )}

        <View style={styles.difficultyContainer}>
          <Text style={styles.difficultyText}>
            Difficulty: {(currentQuestion.difficulty * 100).toFixed(0)}%
          </Text>
        </View>
      </View>

      <View style={styles.answerSection}>
        <Text style={styles.answerLabel}>Your Answer:</Text>
        {renderAnswerInput()}
      </View>

      {showResult && (
        <View style={[styles.resultCard, isCorrect ? styles.resultCorrect : styles.resultIncorrect]}>
          <Text style={styles.resultTitle}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </Text>
          {!isCorrect && (
            <Text style={styles.correctAnswerText}>
              Correct Answer: {currentQuestion.correct_answer}
            </Text>
          )}
          {currentQuestion.explanation && (
            <View style={styles.explanationContainer}>
              <Text style={styles.explanationLabel}>Explanation:</Text>
              <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!showResult ? (
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmitAnswer}
            disabled={isSubmitting || !userAnswer.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Answer</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNextQuestion}
          >
            <Text style={styles.nextButtonText}>
              {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  questionCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    lineHeight: 26,
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },
  difficultyContainer: {
    marginTop: 8,
  },
  difficultyText: {
    fontSize: 14,
    color: '#666',
  },
  answerSection: {
    margin: 16,
    marginTop: 0,
  },
  answerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  optionButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  resultCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultCorrect: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  resultIncorrect: {
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
    borderColor: '#F44336',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  correctAnswerText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    fontWeight: '600',
  },
  explanationContainer: {
    marginTop: 8,
  },
  explanationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
});
