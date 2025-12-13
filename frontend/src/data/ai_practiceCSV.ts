export const AiPractice_CSV = `
question_text,question_type,options,correct_answer,explanation,difficulty,category,subcategory1,subcategory2
"Which function returns the length of a Python list?",multiple_choice,"len(),size(),count(),length()",len(),"Only len() is correct.",0.1,python,basic,list
"Which keyword is used for exception handling in Python?",multiple_choice,"catch,except,rescue,error","except","Python uses except for catching exceptions.",0.2,python,error_handling,try_except
"True/False: A Python tuple is mutable.",true_false,,false,"Tuples are immutable.",0.1,python,basic,tuple
"Which Big-O notation is the fastest?",multiple_choice,"O(1),O(n),O(n log n),O(n^2)",O(1),"Constant time is always fastest.",0.2,cs,algorithm,complexity
"Which data is suitable for one-hot encoding?",multiple_choice,"Ordinal category,Nominal category,Continuous value,Image","Nominal category","Used for categories without order.",0.3,ml,preprocessing,encoding
"Why is MinMaxScaler weak to outliers?",multiple_choice,"Sensitive to outliers,Slow,Ignores categories,Requires labels","Sensitive to outliers","Extreme values distort scaling.",0.4,ml,preprocessing,scaling
"Which advantage do Transformers have over RNNs?",multiple_choice,"Recursion,Parallelization,Lower memory use,Simplicity","Parallelization","Self-attention enables parallel processing.",0.5,ml,models,transformer
"True/False: Embeddings are used for similarity calculation.",true_false,,true,"They represent text as comparable vectors.",0.2,ml,embeddings,similarity
"What issue occurs when top-k=1 in RAG retrieval?",multiple_choice,"Missing relevant chunks,Slow inference,Encoding failure,Overfitting","Missing relevant chunks","Small k increases recall risk.",0.5,ml,raging,retrieval
"Name one method to speed up LLM inference.",text_input,,quantization,"Quantization reduces computation.",0.4,ml,llm,inference
"What Python keyword opens a file safely?",multiple_choice,"file(),open(),with open(),new()", "with open()","Ensures the file closes automatically.",0.2,python,io,file
"True/False: Python lists can hold mixed data types.",true_false,,true,"Lists can store any object.",0.1,python,basic,list
"Which operation is fastest for hash maps?",multiple_choice,"Insert,Delete,Lookup,All of the above","All of the above","Hash maps average O(1) for all.",0.3,cs,data_structure,hashmap
"What is the purpose of normalization?",multiple_choice,"Unify scale,Remove missing values,Encode categories,Remove outliers","Unify scale","Normalization adjusts range.",0.3,ml,preprocessing,norm
"Which model is sensitive to the curse of dimensionality?",multiple_choice,"Logistic regression,k-NN,Naive Bayes,Decision tree","k-NN","Distance-based methods degrade in high dimensions.",0.4,ml,models,knn
"What is the goal of K-means?",multiple_choice,"Classification,Regression,Clustering,Dimensionality reduction","Clustering","K-means groups data into clusters.",0.3,ml,models,clustering
"True/False: PCA is a dimensionality reduction method.",true_false,,true,"PCA projects data to fewer dimensions.",0.2,ml,preprocessing,pca
"What direction does PCA prioritize?",multiple_choice,"Largest variance,Smallest variance,Lowest mean,Random","Largest variance","Principal components maximize variance.",0.4,ml,preprocessing,pca
"What activation helps reduce vanishing gradients?",multiple_choice,"Sigmoid,Tanh,ReLU,Linear","ReLU","ReLU keeps gradients larger for positive values.",0.4,ml,dl,activation
"Which optimizer adaptively adjusts learning rates?",multiple_choice,"SGD,Adam,RMSProp,GD","Adam","Adam uses momentum and adaptive learning rates.",0.5,ml,dl,optimizer
"True/False: Dropout prevents overfitting.",true_false,,true,"Randomly removes neurons to regularize.",0.3,ml,dl,regularization
"What is the purpose of a validation set?",multiple_choice,"Train model,Test generalization,Tune hyperparameters,Store errors","Tune hyperparameters","Validation set guides tuning.",0.3,ml,evaluation,validation
"Which metric suits classification?",multiple_choice,"MSE,Recall,RMSE,MAE","Recall","Recall measures detection of positives.",0.3,ml,evaluation,classification
"What does F1-score balance?",multiple_choice,"Precision & recall,Accuracy & loss,MSE & MAE,Recall & error","Precision & recall","F1 is harmonic mean of both.",0.4,ml,evaluation,f1
"True/False: Overfitting means high training accuracy but low test accuracy.",true_false,,true,"Large gap indicates overfitting.",0.3,ml,concepts,overfitting
"What does tokenization do for LLMs?",multiple_choice,"Compress text,Split text into tokens,Translate text,Generate embeddings","Split text into tokens","Models operate on token units.",0.3,nlp,llm,tokenization
"What does cosine similarity measure?",multiple_choice,"Angle between vectors,Distance,Probability,Gradient","Angle between vectors","Used for comparing embeddings.",0.3,ml,similarity,cosine
"Which algorithm is used in vector search?",multiple_choice,"KD-tree,HNSW,DFS,BFS","HNSW","HNSW is common in ANN search.",0.5,ml,vector_search,ann
"True/False: Embeddings with larger dimensions always perform better.",true_false,,false,"Higher dimensions may cause noise.",0.4,ml,embeddings,dims
"What improves RAG retrieval quality?",multiple_choice,"Larger chunk size,More stopwords,Lower embedding dimension,Single document","Larger chunk size","More context improves retrieval.",0.4,ml,raging,chunking
"What is the role of a vector DB?",multiple_choice,"Store numbers only,Store vectors & search,Compile code,Translate text","Store vectors & search","Vector DB performs ANN search.",0.4,system,vector_db,ann
"What is the purpose of learning rate?",multiple_choice,"Control update size,Control dataset size,Control epochs,Control memory","Control update size","Adjusts how fast model learns.",0.3,ml,dl,training
"True/False: Too high learning rate causes divergence.",true_false,,true,"Large steps miss minima.",0.3,ml,dl,training
"What file format is typically used for training data?",multiple_choice,"jpg,csv,pdf,exe","csv","CSV is common structured format.",0.1,data,storage,file
"What database is suitable for logs?",multiple_choice,"SQL,Redis,Time-series DB,Graph DB","Time-series DB","Optimized for timestamped data.",0.4,system,database,time_series
"What cloud service hosts a container?",multiple_choice,"S3,Lambda,ECS,RDS","ECS","ECS manages containers.",0.4,cloud,aws,ecs
"True/False: S3 is an object storage service.",true_false,,true,"Stores unstructured data objects.",0.2,cloud,aws,s3
"What is REST API’s principle?",multiple_choice,"Stateful,Stateless,Real-time only,Encrypted only","Stateless","Each request contains all info.",0.3,api,rest,design
"What status code means success?",multiple_choice,"200,301,404,500",200,"200=OK.",0.1,api,http,status
"What status code indicates client error?",multiple_choice,"100,200,400,500",400,"4xx is client error.",0.1,api,http,status
"True/False: Webhooks push data to the client.",true_false,,true,"Webhook triggers POST callbacks.",0.3,api,webhook,design
"What does JWT store?",multiple_choice,"Session state,User claims,Images,HTML","User claims","JWT encodes signed user claims.",0.3,security,jwt,auth
"What encryption is used in HTTPS?",multiple_choice,"AES only,RSA only,TLS,TCP","TLS","HTTPS relies on TLS protocol.",0.4,security,network,tls
"True/False: SQL injection exploits unsafe queries.",true_false,,true,"Occurs when input is not sanitized.",0.3,security,sql,attack
"What is the purpose of indexing in SQL?",multiple_choice,"Store duplicates,Speed up search,Encrypt data,Compress tables","Speed up search","Indexes accelerate lookup.",0.4,db,sql,index
"What join returns only matching rows?",multiple_choice,"INNER,LEFT,RIGHT,FULL","INNER","INNER join returns matched rows.",0.3,db,sql,join
"What is ACID in databases?",multiple_choice,"API rules,Transaction guarantees,Caching rules,Search protocol","Transaction guarantees","Ensures reliable transactions.",0.5,db,concept,acid
"What does NoSQL emphasize?",multiple_choice,"Joins,Fixed schema,Scalability,ACID","Scalability","NoSQL favors distributed scaling.",0.4,db,nosql,concept
"True/False: Redis is an in-memory database.",true_false,,true,"Redis stores data in memory.",0.3,db,redis,cache
"What is an API rate limit for?",multiple_choice,"Improve speed,Prevent abuse,Remove headers,Compress responses","Prevent abuse","Protects API from overload.",0.3,api,security,limit
"What is overfitting?",multiple_choice,"High bias,Low variance,Memorizing training data,Low training accuracy","Memorizing training data","Overfit models fail to generalize.",0.4,ml,concept,overfitting
"What technique reduces overfitting?",multiple_choice,"Increase model size,Dropout,Remove regularization,Increase noise","Dropout","Dropout improves generalization.",0.3,ml,dl,regularization
"What is cross-validation used for?",multiple_choice,"Speed up training,Model evaluation,Data generation,Loss tuning","Model evaluation","Evaluates models on folds.",0.4,ml,evaluation,cv
"True/False: k-fold CV trains k models.",true_false,,true,"Each fold trains a separate model.",0.4,ml,evaluation,cv
"What is the purpose of softmax?",multiple_choice,"Normalize probabilities,Reduce dimension,Encode labels,Sort values","Normalize probabilities","Softmax outputs probability distribution.",0.4,ml,dl,activation
"What gradient issue does deep networks face?",multiple_choice,"Exploding/vanishing,Broken layers,Slow I/O,Missing labels","Exploding/vanishing","Gradients become too small or large.",0.5,ml,dl,training
"What helps with exploding gradients?",multiple_choice,"Dropout,Gradient clipping,Bigger model,More epochs","Gradient clipping","Clipping restricts gradient size.",0.5,ml,dl,training
"True/False: BatchNorm stabilizes training.",true_false,,true,"Normalizes layer inputs.",0.4,ml,dl,batchnorm
"What is fine-tuning?",multiple_choice,"Train from scratch,Update all weights on small data,Remove layers,Freeze optimizer","Update all weights on small data","Model adapts to new domain.",0.4,ml,llm,fine_tuning
"What is prompt engineering?",multiple_choice,"Change model weights,Design effective prompts,Store data,Debug code","Design effective prompts","Prompts guide LLM behavior.",0.3,nlp,llm,prompt
"What does temperature control?",multiple_choice,"Model size,Sampling randomness,Token length,Embedding scale","Sampling randomness","Higher temperature increases diversity.",0.3,nlp,llm,inference
"True/False: Top-p sampling filters tokens by cumulative probability.",true_false,,true,"Nucleus sampling selects top mass tokens.",0.4,nlp,llm,decoding
"What speeds up vector search?",multiple_choice,"Larger vectors,HNSW,Sorting by hand,More partitions","HNSW","Efficient ANN graph structure.",0.5,ml,vector_search,ann
"What improves RAG answer accuracy?",multiple_choice,"More retrieval chunks,Fewer embeddings,Shorter prompts,Single document","More retrieval chunks","More context increases recall.",0.5,ml,raging,retrieval
"What is the purpose of cosine similarity?",multiple_choice,"Angle comparison,Length comparison,Sorting tokens,Compression","Angle comparison","Measures similarity of vectors.",0.3,ml,similarity,cosine
"What is the goal of regularization?",multiple_choice,"Increase accuracy,Prevent overfitting,Train faster,Add noise","Prevent overfitting","Regularization controls complexity.",0.3,ml,concept,regularization
"True/False: L2 regularization penalizes large weights.",true_false,,true,"L2 reduces weight magnitude.",0.3,ml,dl,regularization
"What is a hyperparameter?",multiple_choice,"Trainable weight,Model setting,Dataset item,Loss value","Model setting","Hyperparameters are external settings.",0.3,ml,concept,hyperparameter
"What is the purpose of an epoch?",multiple_choice,"One full pass of dataset,One batch,One prediction,One loss update","One full pass of dataset","Epoch means full iteration.",0.2,ml,dl,training
"Which metric suits regression?",multiple_choice,"Accuracy,F1,MSE,Recall","MSE","MSE measures squared error.",0.3,ml,evaluation,regression
"True/False: Larger models always outperform smaller ones.",true_false,,false,"Bigger models may overfit.",0.3,ml,concept,bias_variance
"What is gradient descent used for?",multiple_choice,"Find minima,Sort data,Encode labels,Split data","Find minima","Optimizes model parameters.",0.2,ml,optimization,gd
"What is backpropagation?",multiple_choice,"Forward pass,Error propagation,Data cleaning,Preprocessing","Error propagation","Computes gradients through chain rule.",0.4,ml,dl,training
"What improves training stability?",multiple_choice,"Large LR,Small batch size,Learning rate scheduling,Random layers","Learning rate scheduling","Schedules help stabilize convergence.",0.4,ml,dl,training
"True/False: Self-attention allows global dependency modeling.",true_false,,true,"Tokens attend to all positions.",0.4,ml,models,transformer
"What is a common embedding distance metric?",multiple_choice,"Manhattan,Cosine,Hamming,Jaccard","Cosine","Cosine is widely used for vectors.",0.3,ml,embeddings,distance
"What is the purpose of a loss function?",multiple_choice,"Measure error,Sort data,Encode values,Generate text","Measure error","Loss quantifies prediction quality.",0.2,ml,concept,loss
"What does ROC-AUC measure?",multiple_choice,"Class separation,Loss minimum,Model speed,Embedding quality","Class separation","AUC measures ranking ability.",0.5,ml,evaluation,roc
"What helps reduce model size?",multiple_choice,"Pruning,More layers,Bigger optimizer,Duplicate weights","Pruning","Removes insignificant weights.",0.4,ml,dl,pruning
"True/False: Quantization reduces memory usage.",true_false,,true,"Quantization stores smaller weights.",0.3,ml,llm,quantization
"What improves throughput in LLM inference?",multiple_choice,"Batching,Longer prompts,High temperature,Full precision","Batching","Batching increases parallelism.",0.4,ml,llm,inference
"What is a typical vector dimension?",multiple_choice,"8,32,768,10000",768,"Many LLM embeddings use 768 dims.",0.3,ml,embeddings,dims
"What increases embedding quality?",multiple_choice,"Clean text,Random noise,Short sentences only,Stopwords only","Clean text","Clean input improves embeddings.",0.3,ml,embeddings,data
"True/False: Larger chunk size in RAG increases context.",true_false,,true,"Larger chunks contain more info.",0.3,ml,raging,chunking
"What is a GPU mainly used for?",multiple_choice,"Matrix operations,Network routing,Disk IO,Caching","Matrix operations","GPUs accelerate parallel math.",0.2,system,hardware,gpu
"What tensor format does PyTorch use?",multiple_choice,"pTensor,Tensor,Matrix,Array","Tensor","PyTorch operates on tensors.",0.2,python,pytorch,tensor
"What is the purpose of DataLoader?",multiple_choice,"Load data in batches,Train model,Log metrics,Store weights","Load data in batches","Handles batching and shuffling.",0.3,python,pytorch,dataloader
"True/False: Autograd computes gradients automatically.",true_false,,true,"PyTorch autograd tracks operations.",0.3,python,pytorch,autograd
"What is an embedding layer used for?",multiple_choice,"Convert tokens to vectors,Decode images,Sort text,Compress folders","Convert tokens to vectors","Transforms ids into dense vectors.",0.3,nlp,embedding,layer
`;
