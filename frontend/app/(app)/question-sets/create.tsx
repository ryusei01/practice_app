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
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { questionSetsApi } from '../../../src/api/questionSets';
import { questionsApi } from '../../../src/api/questions';
import { useAuth } from '../../../src/contexts/AuthContext';

export default function CreateQuestionSetScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [price, setPrice] = useState('0');
  const [isPublished, setIsPublished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const handleUploadCSV = async (questionSetId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        router.back();
        return;
      }

      const file = result.assets[0];

      Alert.alert(
        'Upload CSV',
        `Selected: ${file.name}\n\nUpload this file?`,
        [
          {
            text: 'Cancel',
            onPress: () => router.back(),
            style: 'cancel',
          },
          {
            text: 'Upload',
            onPress: async () => {
              try {
                setIsLoading(true);
                const response = await questionsApi.bulkUploadCSV(questionSetId, {
                  uri: file.uri,
                  name: file.name,
                  type: file.mimeType || 'text/csv',
                });

                if (response.total_errors > 0) {
                  Alert.alert(
                    'Upload Complete with Errors',
                    `Created: ${response.total_created} questions\nErrors: ${response.total_errors}\n\nFirst few errors:\n${response.errors?.slice(0, 3).join('\n')}`,
                    [{ text: 'OK', onPress: () => router.push(`/(app)/question-sets/${questionSetId}`) }]
                  );
                } else {
                  Alert.alert(
                    'Success',
                    `Successfully imported ${response.total_created} questions!`,
                    [{ text: 'OK', onPress: () => router.push(`/(app)/question-sets/${questionSetId}`) }]
                  );
                }
              } catch (error: any) {
                console.error('Failed to upload CSV:', error);
                Alert.alert(
                  'Error',
                  error.response?.data?.detail || 'Failed to upload CSV',
                  [{ text: 'OK', onPress: () => router.back() }]
                );
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to pick document:', error);
      Alert.alert('Error', 'Failed to select file', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  const handleCreate = async () => {
    console.log('handleCreate called');
    console.log('User:', user);
    console.log('Title:', title);
    console.log('Category:', category);

    if (!title || !category) {
      Alert.alert('Error', 'Please fill in title and category');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    // 非公開の場合、値段は0に固定
    if (!isPublished && parseInt(price) > 0) {
      Alert.alert('Warning', 'Private question sets cannot have a price. Price will be set to 0.');
    }

    setIsLoading(true);
    console.log('Loading state set to true');
    try {
      const tagsArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const questionSetData = {
        title,
        description: description || undefined,
        category,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        price: isPublished ? (parseInt(price) || 0) : 0,
        is_published: isPublished,
      };

      console.log('Question set data:', questionSetData);

      // クラウドに保存（プレミアムユーザー or デフォルト動作）
      console.log('Calling questionSetsApi.create...');
      const result = await questionSetsApi.create(questionSetData);
      console.log('API call result:', result);
      console.log('Result type:', typeof result);
      console.log('Result keys:', Object.keys(result));

      const createdQuestionSetId = result.id;
      console.log('Created question set ID:', createdQuestionSetId);

      if (!createdQuestionSetId) {
        console.error('No ID returned from API!');
        Alert.alert('Error', 'Failed to get question set ID from server');
        return;
      }

      // 問題集作成成功、詳細画面に遷移
      router.push(`/(app)/question-sets/${createdQuestionSetId}`);
    } catch (error: any) {
      console.error('Error creating question set:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to create question set'
      );
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Enter question set title"
          editable={!isLoading}
        />

        <Text style={styles.label}>Category *</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="e.g., Math, English, Programming"
          editable={!isLoading}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your question set"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!isLoading}
        />

        <Text style={styles.label}>Tags (comma separated)</Text>
        <TextInput
          style={styles.input}
          value={tags}
          onChangeText={setTags}
          placeholder="e.g., beginner, TOEIC, Python"
          editable={!isLoading}
        />

        <Text style={styles.label}>Price (¥) {!isPublished && '(Private sets are free)'}</Text>
        <TextInput
          style={[styles.input, !isPublished && styles.inputDisabled]}
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          keyboardType="numeric"
          editable={!isLoading && isPublished}
        />

        <View style={styles.switchContainer}>
          <Text style={styles.label}>Publish immediately</Text>
          <Switch
            value={isPublished}
            onValueChange={setIsPublished}
            disabled={isLoading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create</Text>
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 100,
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
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
