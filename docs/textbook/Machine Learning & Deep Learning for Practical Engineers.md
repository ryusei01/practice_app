# Machine Learning & Deep Learning for Practical Engineers

## From Fundamentals to Implementation

---

## Chapter 1: What Is Machine Learning? (A Practical View)

Machine learning is a technology that:

> **Learns patterns from data instead of relying on explicitly written rules.**

In real-world engineering, the following three points matter more than theory.

### What Really Matters in Practice

1. **Data preprocessing matters more than the model itself**
2. **Reproducibility and maintainability matter more than raw accuracy**
3. **Understanding model behavior matters more than mathematical derivations**

Machine learning systems live in production, not in notebooks.

---

## Chapter 2: Supervised Learning – The Common Structure

Almost all supervised learning workflows share the same structure.

### Standard Workflow

1. Data collection
2. Preprocessing (missing values, scaling)
3. Model selection
4. Training
5. Evaluation
6. Inference

### The Universal API Pattern

```python
model.fit(X_train, y_train)
pred = model.predict(X_test)
```

The separation between **fit** and **predict** exists in almost all ML libraries.

- `fit` learns from training data
- `predict` applies learned rules to unseen data

---

## Chapter 3: Decision Trees and Ensembles (Frequently Used in Practice)

### Characteristics of Decision Trees

- Highly interpretable
- Require little preprocessing
- Prone to overfitting

### Basic Usage

```python
from sklearn.tree import DecisionTreeClassifier

model = DecisionTreeClassifier(max_depth=3)
model.fit(X, y)
```

### Important Hyperparameters

- **max_depth**: deeper trees increase overfitting risk
- **min_samples_leaf**: improves robustness to noise

---

## Random Forests

```python
from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier(
    n_estimators=100,
    max_depth=5,
    random_state=42
)
```

### Why Random Forests Are Popular

- An ensemble of multiple decision trees
- Good balance between accuracy and stability
- Often the **first model to try** in real-world projects

---

## Chapter 4: Preprocessing and Data Leakage

### Standardization (Critical in Practice)

```python
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)
```

### Why `fit` and `transform` Must Be Separated

If information from the test set leaks into training, the evaluation becomes invalid.

> **Data leakage is one of the most common and costly mistakes in production ML.**

---

## Chapter 5: Neural Networks – The Basics

### Network Structure

- Input layer
- Hidden layers
- Output layer

```python
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(10, 32),
    nn.ReLU(),
    nn.Linear(32, 1)
)
```

### Activation Functions

| Function  | Characteristics              |
| --------- | ---------------------------- |
| Sigmoid   | Prone to vanishing gradients |
| ReLU      | Practical standard           |
| LeakyReLU | Mitigates dying ReLU         |

---

## Chapter 6: Training Mechanics (PyTorch)

### Basic Training Loop

```python
for x, y in dataloader:
    optimizer.zero_grad()
    output = model(x)
    loss = criterion(output, y)
    loss.backward()
    optimizer.step()
```

### Critical Points

- Forgetting `zero_grad()` causes gradient accumulation
- `loss.backward()` computes gradients
- `optimizer.step()` updates parameters

---

## Chapter 7: train vs eval Mode

```python
model.train()
model.eval()
```

| Mode  | Dropout  | BatchNorm             |
| ----- | -------- | --------------------- |
| train | Enabled  | Uses batch statistics |
| eval  | Disabled | Uses fixed statistics |

> Forgetting `eval()` during inference is a classic production bug.

---

## Chapter 8: Choosing the Right Loss Function

### Classification

- Binary classification:

  - Binary Cross Entropy + Sigmoid

- Multiclass classification:

  - Cross Entropy + Softmax

### Regression

- Mean Squared Error (MSE)
- Mean Absolute Error (MAE)

---

## Chapter 9: Preventing Overfitting (Essential in Practice)

- Data augmentation
- Regularization (L2)
- Dropout
- Early stopping

```python
nn.Dropout(0.5)
```

---

## Chapter 10: Choosing the Right Evaluation Metric

| Task                      | Recommended Metric |
| ------------------------- | ------------------ |
| Imbalanced classification | F1-score / ROC-AUC |
| Regression                | RMSE               |
| Production systems        | Business KPIs      |

> Accuracy alone is often misleading and dangerous in real systems.

---

## Final Message

Machine learning in practice is less about fancy models and more about:

- Data correctness
- Reproducibility
- Operational safety

Understanding these fundamentals scales to any advanced model.
