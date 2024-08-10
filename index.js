import express from 'express';
import cors from 'cors';
import {
  FunctionDeclarationSchemaType,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import { googleApiKey, serverPort, fb_projectId } from './utils/envConfig.js';
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: fb_projectId,
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const port = serverPort;

const genAI = new GoogleGenerativeAI(googleApiKey);

//Validation rules
const titleValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 50,
  fieldName: 'Widget title'
};

const systemInstructionsValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'System instructions'
};

const promptValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'Prompt'
};
const typeValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 200,
  fieldName: 'Type'
};
const flashcardKeyValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'Flashcard key'
};

const flashcardValueValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'Flashcard value'
};

const questionKeyValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'Question key'
};

const questionValueValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'Question value'
};

const quizKeyValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'Quiz key'
};

const quizValueValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'Quiz value'
};

const textWidgetValueValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 500,
  fieldName: 'Text value'
};
const creativityLevelValidationRules = {
  required: false,
  minLength: 0,
  maxLength: 1,
  fieldName: 'Creativity level'
};


//Validate string fields
const validateField = (value, { required, minLength, maxLength, fieldName }) => {
  if (required && !value) {
    return `${fieldName} is required`;
  }
  if (value) {
    if (minLength && value.length < minLength) {
      return `${fieldName} must be at least ${minLength} characters long`;
    }
    if (maxLength && value.length > maxLength) {
      return `${fieldName} must be less than ${maxLength} characters long`;
    }
  }
  return '';
};

//Validate number fields
const validateNumberField = (value, { required, minValue, maxValue, fieldName }) => {
  if (required && value === undefined) {
    return `${fieldName} is required`;
  }
  if (value !== undefined) {
    if (minValue !== undefined && value < minValue) {
      return `${fieldName} must be at least ${minValue}`;
    }
    if (maxValue !== undefined && value > maxValue) {
      return `${fieldName} must be less than ${maxValue}`;
    }
  }
  return '';
};

//Validate all fields
const validateAllFields = (data) => {

  const errors = {};


  const titleError = validateField(data.title, titleValidationRules);
  const systemInstructionsError = validateField(data.systemInstructions, systemInstructionsValidationRules);
  const promptError = validateField(data.prompt, promptValidationRules);
  const typeError = validateField(data.type, typeValidationRules);
  const creativityLevelError = validateNumberField(data.creativityLevel, creativityLevelValidationRules);
  
  
  if (titleError || typeError || systemInstructionsError || promptError || creativityLevelError) {

    errors['title'] = titleError;
    errors['systemInstructions'] = systemInstructionsError;
    errors['prompt'] = promptError;
    errors['type'] = typeError;
    errors['creativityLevel'] = creativityLevelError;

  }

  switch (data.type) {
    case 'flashcard':


      const flashcardKeyError = validateField(data.flashcardKey, flashcardKeyValidationRules);
      const flashcardValueError = validateField(data.flashcardValue, flashcardValueValidationRules);
    

      if (flashcardKeyError || flashcardValueError) {
        errors['flashcardKey'] = flashcardKeyError;
        errors['flashcardValue'] = flashcardValueError;
      }
      break;
    case 'quiz':

      const quizKeyError = validateField(data.quizKey, quizKeyValidationRules);
      const quizValueError = validateField(data.quizValue, quizValueValidationRules);
      
      if (quizKeyError || quizKeyError) {
        errors['quizKey'] = quizKeyError;
        errors['quizValue'] = quizValueError;
      }
      break;

    case 'text':
      const textWidgetValueError = validateField(data.textWidgetValue, textWidgetValueValidationRules);
      if (textWidgetValueError) {
        errors['textWidgetValue'] = textWidgetValueError;

      }
      break;
    case 'question':

      const questionKeyError = validateField(data.questionKey, questionKeyValidationRules);
      const questionValueError = validateField(data.questionValue, questionValueValidationRules);
      if (questionKeyError || questionValueError) {

        errors['questionKey'] = questionKeyError;
        errors['questionValue'] = questionValueError;

      }
      break;
    default:
      break;
  }

  return errors;
}

//Gemini controlled generation call
app.post('/gemini-controlled-generation', async (req, res) => {
  

  

  try {
    const idToken = req.headers.authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken.trim());

    const userId = decodedToken.user_id
    

  } catch (error) {
    console.error('Unauthorized call: ' + error)
    res.status(401).send('Unauthorized call');
    return;
  }


  const { data } = req.body; 

  //Validate before calling gemini endpoint
  const allErrors = validateAllFields(data);
  if (Object.keys(allErrors).length > 0) {
    return res.status(400).json(
      allErrors
    );
  }


  var schema = {}

  //System instruction modification
  let sysInstructionNote = "";
  let jsonFormatNote = ". Generate JSON output in a compact format with minimal line breaks, strictly adhering to JSON syntax. Avoid unnecessary characters like whitespace, quotation marks in string control characters, and invalid escape sequences. Enforce strict adherence to the provided schema, including limiting the number of items in array fields to prevent excessive data generation. Make sure the length of the response is not too long.";

  //Check widget type before applying schema
  switch (data.type) {
    case 'flashcard':
      schema = {
        description: "Flash card generation",
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
          content: {
            type: FunctionDeclarationSchemaType.ARRAY,
            items: {
              type: FunctionDeclarationSchemaType.OBJECT,
              properties: {
                key: {
                  type: FunctionDeclarationSchemaType.STRING,
                  description: data.flashcardKey + jsonFormatNote,
                  nullable: false,
                },
                value: {
                  type: FunctionDeclarationSchemaType.STRING,
                  description: data.flashcardValue + jsonFormatNote,
                  nullable: false,
                },
              },
              required: ["key", "value"],
            },
          },
        },
        required: ["content"],
      };
      break;
    case 'quiz':
      schema = {
        description: "Quiz generation",
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
          content: {
            type: FunctionDeclarationSchemaType.ARRAY,
            items: {
              type: FunctionDeclarationSchemaType.OBJECT,
              properties: {
                question: {
                  type: FunctionDeclarationSchemaType.STRING,
                  description: data.quizKey + jsonFormatNote,
                  nullable: false,
                },
                answers: {
                  type: FunctionDeclarationSchemaType.ARRAY,
                  items: {
                    type: FunctionDeclarationSchemaType.STRING,
                    description: data.quizValue + jsonFormatNote,
                  }
                },
                correctAnswer: {
                  type: FunctionDeclarationSchemaType.STRING,
                  description: "The index of the correct answer. The first answer will have an index of 0 and so on.",
                  nullable: false,
                },
              },
              required: ["question", "answers", "correctAnswer"],
            },
          },
        },
        required: ["content"],
      };
      break;
    case 'text':
      // schema = {
      //   description: "Text generation",
      //   type: FunctionDeclarationSchemaType.OBJECT,
      //   properties: {
      //     content: {
      //       type: FunctionDeclarationSchemaType.STRING,
      //       description: data.textWidgetValue + '. Formatted as an HTML string',
      //       nullable: false,
      //     },
      //   },
      //   required: ["content"],
      // };

      sysInstructionNote = ". Only generate 1 item inside the JSON response.";

      schema = {
        description: "Text generation",
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
          content: {
            type: FunctionDeclarationSchemaType.ARRAY,
            items: {
              type: FunctionDeclarationSchemaType.OBJECT,
              properties: {
                value: {
                  type: FunctionDeclarationSchemaType.STRING,
                  description: data.textWidgetValue + jsonFormatNote,
                  nullable: false,
                }
              },
              required: ["value"],
            },
          },
        },
        required: ["content"],
      };
      break;
    case 'question':
      
        // schema = {
        //   description: "Question generation",
        //   type: FunctionDeclarationSchemaType.OBJECT,
        //   properties: {
        //     content: {
        //       type: FunctionDeclarationSchemaType.STRING,
        //       description: data.questionKey + '. Formatted as an HTML string',
        //       nullable: false,
        //     },
        //   },
        //   required: ["content"],
        // };
        sysInstructionNote = ". Only generate 1 item inside the JSON response.";

        schema = {
          description: "Question generation",
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            content: {
              type: FunctionDeclarationSchemaType.ARRAY,
              items: {
                type: FunctionDeclarationSchemaType.OBJECT,
                properties: {
                  value: {
                    type: FunctionDeclarationSchemaType.STRING,
                    description: data.questionKey + jsonFormatNote,
                    nullable: false,
                  }
                },
                required: ["value"],
              },
            },
          },
          required: ["content"],
        };
        break;
    case 'answer':
        // schema = {
        //   description: "Comment the answer",
        //   type: FunctionDeclarationSchemaType.OBJECT,
        //   properties: {
        //     content: {
        //       type: FunctionDeclarationSchemaType.STRING,
        //       description: data.questionValue + '. Formatted as an HTML string',
        //       nullable: false,
        //     },
        //   },
        //   required: ["content"],
        // };

        sysInstructionNote = ". Only generate 1 item inside the JSON response.";
        schema = {
          description: "Comment the answer",
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            content: {
              type: FunctionDeclarationSchemaType.ARRAY,
              items: {
                type: FunctionDeclarationSchemaType.OBJECT,
                properties: {
                  value: {
                    type: FunctionDeclarationSchemaType.STRING,
                    description: data.questionValue + jsonFormatNote,
                    nullable: false,
                  }
                },
                required: ["value"],
              },
            },
          },
          required: ["content"],
        };
        break;
    default:
   
      break;
  }
  
  //Gemini model setup
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: data.systemInstructions + sysInstructionNote + jsonFormatNote,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: data.creativityLevel,
    },
  });


  try {

   

    //Custom refresh prompt concatenation
    var modifiedPrompt = data.prompt;
    if (data.customRefreshPrompt !== "" && data.customRefreshPrompt !== undefined) {
      modifiedPrompt += ". " + data.customRefreshPrompt
    }

    //Quick refresh
    var contentKeysToAvoid = "";
    if (data.isQuickRefresh && data.content) {
      if (Array.isArray(data.content)) {
    
          contentKeysToAvoid = data.content.map(item => item.key).join(';')
  
    
        modifiedPrompt += ". Try not to repeat these: " + contentKeysToAvoid;
      } else {
        const substringContent = data.content.substring(0, 300);
        modifiedPrompt += ". Try not to repeat these: " + substringContent;
      }
    }

    //For question/answer widget answer
    if (data.type == "answer" && data.content && data.answer && data.questionValue) {
      modifiedPrompt = "Based on the question: " + data.content[0].value + " and answer: " + data.answer + " given. "  + data.questionValue
    }


    const response = await model.generateContent(modifiedPrompt);
    const myResponse = response.response.text()

    
    res.send(JSON.stringify(myResponse));
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error, please refresh if some widgets failed to load.');
  }


});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
