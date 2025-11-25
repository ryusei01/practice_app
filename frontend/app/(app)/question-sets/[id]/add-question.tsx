import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { questionsApi } from '../../../../src/api/questions';

export default function AddQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false' | 'text_input'>('multiple_choice');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState('0.5');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    if (!questionText || !correctAnswer) {
      Alert.alert('Error', 'Please fill in question text and correct answer');
      return;
    }

    if (questionType === 'multiple_choice' && options.every(opt => !opt.trim())) {
      Alert.alert('Error', 'Please provide at least one option for multiple choice');
      return;
    }

    setIsLoading(true);
    try {
      const validOptions = options.filter(opt => opt.trim().length > 0);

      await questionsApi.create({
        question_set_id: id,
        question_text: questionText,
        question_type: questionType,
        options: questionType === 'multiple_choice' ? validOptions : undefined,
        correct_answer: correctAnswer,
        explanation: explanation || undefined,
        difficulty: parseFloat(difficulty) || 0.5,
        category: category || undefined,
      });

      Alert.alert('Success', 'Question added successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to add question'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.label}>Question Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              questionType === 'multiple_choice' && styles.typeButtonActive,
            ]}
            onPress={() => setQuestionType('multiple_choice')}
          >
            <Text
              style={[
                styles.typeButtonText,
                questionType === 'multiple_choice' && styles.typeButtonTextActive,
              ]}
            >
              Multiple Choice
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              questionType === 'true_false' && styles.typeButtonActive,
            ]}
            onPress={() => setQuestionType('true_false')}
          >
            <Text
              style={[
                styles.typeButtonText,
                questionType === 'true_false' && styles.typeButtonTextActive,
              ]}
            >
              True/False
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              questionType === 'text_input' && styles.typeButtonActive,
            ]}
            onPress={() => setQuestionType('text_input')}
          >
            <Text
              style={[
                styles.typeButtonText,
                questionType === 'text_input' && styles.typeButtonTextActive,
              ]}
            >
              Text Input
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Question Text *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={questionText}
          onChangeText={setQuestionText}
          placeholder="Enter your question"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!isLoading}
        />

        {questionType === 'multiple_choice' && (
          <>
            <Text style={styles.label}>Options</Text>
            {options.map((option, index) => (
              <TextInput
                key={index}
                style={styles.input}
                value={option}
                onChangeText={(value) => handleOptionChange(index, value)}
                placeholder={`Option ${index + 1}`}
                editable={!isLoading}
              />
            ))}
          </>
        )}

        <Text style={styles.label}>Correct Answer *</Text>
        <TextInput
          style={styles.input}
          value={correctAnswer}
          onChangeText={setCorrectAnswer}
          placeholder="Enter the correct answer"
          editable={!isLoading}
        />

        <Text style={styles.label}>Explanation</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={explanation}
          onChangeText={setExplanation}
          placeholder="Explain why this is the correct answer"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!isLoading}
        />

        <Text style={styles.label}>Difficulty (0.0 - 1.0)</Text>
        <TextInput
          style={styles.input}
          value={difficulty}
          onChangeText={setDifficulty}
          placeholder="0.5"
          keyboardType="decimal-pad"
          editable={!isLoading}
        />

        <Text style={styles.label}>Category</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="e.g., Math, Grammar"
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Add Question</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#007AFF',
  },
});
