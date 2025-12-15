# Decision Trees and Random Forests

## 1. Simple Example Dataset

We use an extremely small dataset so that every decision can be understood step by step.

| Temperature | Rain | Go Outside |
| ----------- | ---- | ---------- |
| High        | No   | Go         |
| Low         | Yes  | Stay       |
| High        | Yes  | Stay       |

- **Features**:

  - Temperature: High / Low
  - Rain: Yes / No

- **Label**:

  - Go Outside: Go / Stay

---

## 2. Decision Tree: Intuition First

A decision tree is a sequence of yes/no questions, just like human reasoning.

### 2.1 Human Reasoning

1. Is it raining?

   - Yes → Stay
   - No → Go

This single rule correctly classifies all examples.

### 2.2 Decision Tree as Code

```python
if rain == "Yes":
    decision = "Stay"
else:
    decision = "Go"
```

This is essentially what a trained decision tree learns.

---

## 3. Decision Tree in Python (scikit-learn)

```python
import pandas as pd
from sklearn.tree import DecisionTreeClassifier

X = pd.DataFrame({
    "temperature": ["High", "Low", "High"],
    "rain": ["No", "Yes", "Yes"]
})

y = ["Go", "Stay", "Stay"]

# One-hot encoding
X_encoded = pd.get_dummies(X)

model = DecisionTreeClassifier(random_state=0)
model.fit(X_encoded, y)
```

### What the model learned

- If Rain = Yes → Stay
- If Rain = No → Go

---

## 4. From Decision Tree to Random Forest

A **Random Forest** is:

> Multiple decision trees trained with randomness, combined by majority voting.

---

## 5. Where Does the Randomness Come From?

Each tree is trained using:

1. **Bootstrap sampling**: random sampling of rows (with replacement)
2. **Random feature selection**: only a subset of features is considered at each split

This makes each tree slightly different.

---

## 6. Example Trees in the Forest

Even with the same data, trees may look different.

- **Tree 1**:

  - If Rain = Yes → Stay
  - Else → Go

- **Tree 2**:

  - If Temperature = High and Rain = Yes → Stay
  - Else → Go

- **Tree 3**:

  - If Rain = No → Go
  - Else → Stay

---

## 7. Majority Voting

For a new input:

```text
Temperature = High
Rain = Yes
```

Predictions:

- Tree 1 → Stay
- Tree 2 → Stay
- Tree 3 → Stay

Final prediction:

```text
Stay
```

---

## 8. Random Forest in Python

```python
from sklearn.ensemble import RandomForestClassifier

rf = RandomForestClassifier(
    n_estimators=3,
    random_state=0
)

rf.fit(X_encoded, y)
```

### Prediction Example

```python
test = pd.DataFrame({
    "temperature": ["High"],
    "rain": ["Yes"]
})

test_encoded = pd.get_dummies(test)
test_encoded = test_encoded.reindex(columns=X_encoded.columns, fill_value=0)

rf.predict(test_encoded)
```

---

## 9. Why Random Forest Is Better Than a Single Tree

| Model         | Characteristic         |
| ------------- | ---------------------- |
| Decision Tree | Easy to overfit        |
| Random Forest | More stable and robust |

**Reason**:

- Individual trees make different mistakes
- Voting averages out errors

---

## 10. Mental Model

- Decision Tree: one very opinionated person
- Random Forest: a committee making a decision

Accuracy comes from **diversity + voting**, not smarter trees.

---

## 11. Step-by-Step Walkthrough (Very Detailed)

### 11.1 Enumerating All Possible Rules

With two binary features, a decision tree can consider rules such as:

- Rain only
- Temperature only
- Rain → then Temperature
- Temperature → then Rain

The algorithm evaluates all possible splits and selects the one that **maximizes information gain**.

In this dataset, splitting by **Rain** results in perfectly pure nodes.

---

### 11.2 Entropy Intuition (No Math)

- Before splitting: mixed outcomes (Go / Stay)
- After splitting by Rain:

  - Rain = Yes → all Stay
  - Rain = No → all Go

Entropy becomes zero. This is why Rain is chosen.

---

## 12. Decision Tree as Explicit Rules

The trained tree can be written explicitly:

```text
IF Rain = Yes:
    Stay
ELSE:
    Go
```

This transparency is a key strength of decision trees.

---

## 13. Random Forest: Same Data, Different Views

Although the dataset is small, Random Forest still applies randomness.

### 13.1 Bootstrap Sampling Example

Tree 1 may see:

- (High, No, Go)
- (High, Yes, Stay)
- (High, Yes, Stay)

Tree 2 may see:

- (Low, Yes, Stay)
- (High, No, Go)
- (Low, Yes, Stay)

Rows can be duplicated or omitted.

---

### 13.2 Feature Subsampling Example

At each split, the tree may only consider:

- Rain only, or
- Temperature only

This forces diversity among trees.

---

## 14. Random Forest Prediction: Internal Process

For one input:

```text
Temperature = High
Rain = Yes
```

Each tree:

1. Applies its own rules
2. Outputs a prediction

The forest:

- Collects all predictions
- Selects the majority class

---

## 15. Bias–Variance Perspective (Intuition)

- Decision Tree:

  - Low bias
  - High variance

- Random Forest:

  - Slightly higher bias
  - Much lower variance

Lower variance leads to better generalization.

---

## 16. Practical Notes

- Small datasets are for understanding
- Real datasets require hundreds or thousands of samples
- Random Forest works well with minimal tuning

---

## 17. Common Misunderstandings

- Random Forest is NOT one big tree
- Trees are NOT trained sequentially
- Performance comes from averaging

---

## 18. Exercises

1. What happens if you remove the Temperature feature?
2. Create a dataset where Temperature becomes the first split.
3. Increase `n_estimators` and observe prediction stability.

---

## 19. Key Takeaways

- Decision Trees learn human-readable rules
- Random Forests reduce instability via randomness
- The same intuition applies to large-scale problems
