import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

const ALCOHOL_TYPES = ["Vodka", "Gin", "Rum", "Tequila", "Whiskey", "Brandy"];

interface Recipe {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  garnish: string;
  imageUrl?: string;
}

const App = () => {
  const [theme, setTheme] = useState('dark');
  const [selectedAlcohols, setSelectedAlcohols] = useState<string[]>([]);
  const [mixers, setMixers] = useState('');
  const [otherIngredients, setOtherIngredients] = useState('');
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.className = `${theme}-theme`;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleAlcoholSelect = (alcohol: string) => {
    setSelectedAlcohols(prev =>
      prev.includes(alcohol)
        ? prev.filter(a => a !== alcohol)
        : [...prev, alcohol]
    );
  };
  
  const generateImageForRecipe = async (recipe: Recipe, ai: GoogleGenAI): Promise<Recipe> => {
      try {
        const imagePrompt = `A vibrant, professional photograph of a "${recipe.name}" cocktail. The drink is freshly made, garnished with "${recipe.garnish}". It is served in an elegant cocktail glass on a dark, moody bar counter. The image should be hyper-realistic with beautiful lighting.`;

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: imagePrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '1:1',
            },
        });

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
        return { ...recipe, imageUrl };
      } catch (e) {
        console.error("Image generation failed for recipe:", recipe.name, e);
        return recipe; // Return recipe without image if generation fails
      }
    };

  const generateRecipe = useCallback(async (isSurprise: boolean) => {
    if (!API_KEY) {
      setError("API key is not configured. Please set the API_KEY environment variable.");
      return;
    }
    setLoading(true);
    setLoadingMessage('Mixing up some recipes...');
    setError(null);
    setRecipes(null);

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    let prompt = '';
    if (isSurprise) {
      prompt = "Generate between 2 and 4 creative and surprising cocktail recipes. They can be anything, from classics with a twist to something completely new.";
    } else {
      if (selectedAlcohols.length === 0 && !mixers && !otherIngredients) {
          setError("Please select an alcohol or provide some mixers/ingredients.");
          setLoading(false);
          return;
      }
      prompt = `Create between 2 and 4 distinct cocktail recipes based on the following preferences:
      - Primary Alcohols: ${selectedAlcohols.join(', ') || 'Any'}
      - Available Mixers: ${mixers || 'Any'}
      - Other Ingredients: ${otherIngredients || 'Any'}
      
      IMPORTANT: At least one recipe must use all the provided ingredients (alcohols, mixers, and others). The other recipes can be creative variations using a subset of the ingredients.
      
      Please provide a unique name for each cocktail.`;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "The creative name of the cocktail." },
                  description: { type: Type.STRING, description: "A brief, enticing description of the cocktail." },
                  ingredients: {
                    type: Type.ARRAY,
                    items: { 
                        type: Type.STRING,
                        description: "Ingredient name with measurement, e.g., '2 oz Vodka'."
                    },
                    description: "List of ingredients with measurements."
                  },
                  instructions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Step-by-step instructions to make the cocktail."
                  },
                  garnish: { type: Type.STRING, description: "Suggested garnish for the cocktail, e.g., 'Lime wedge'." }
                },
                required: ["name", "description", "ingredients", "instructions", "garnish"]
            }
          },
        },
      });

      const jsonText = response.text.trim();
      const parsedRecipes: Recipe[] = JSON.parse(jsonText);
      
      setLoadingMessage('Creating cocktail portraits...');
      
      const recipesWithImages = await Promise.all(
          parsedRecipes.map(recipe => generateImageForRecipe(recipe, ai))
      );

      setRecipes(recipesWithImages);

    } catch (e) {
      console.error(e);
      setError("Sorry, I couldn't come up with a recipe. The ingredients might be too unusual. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [selectedAlcohols, mixers, otherIngredients]);

  return (
    <>
      <div className="background-wrapper" aria-hidden="true">
        <ul className="bubbles">
          {[...Array(10)].map((_, i) => <li key={i} className="bubble"></li>)}
        </ul>
      </div>
      <div className="app-container">
        <div className="theme-switcher" onClick={toggleTheme} role="switch" aria-checked={theme === 'dark'} aria-label="Toggle theme">
          <label className="switch">
            <input type="checkbox" checked={theme === 'dark'} onChange={() => {}} />
            <span className="slider"></span>
          </label>
        </div>

        <main className="main-content">
          <header>
            <h1>AI Cocktail Companion</h1>
            <p>Craft your perfect drink or let us surprise you!</p>
          </header>

          <div className="form-group">
            <label>Choose your spirit(s)</label>
            <div className="alcohol-options">
              {ALCOHOL_TYPES.map(alcohol => (
                <div
                  key={alcohol}
                  className={`alcohol-option ${selectedAlcohols.includes(alcohol) ? 'selected' : ''}`}
                  onClick={() => handleAlcoholSelect(alcohol)}
                  role="checkbox"
                  aria-checked={selectedAlcohols.includes(alcohol)}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && handleAlcoholSelect(alcohol)}
                >
                  {alcohol}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="mixers">What mixers do you have?</label>
            <input
              id="mixers"
              type="text"
              className="text-input"
              value={mixers}
              onChange={e => setMixers(e.target.value)}
              placeholder="e.g., tonic water, orange juice, soda"
            />
          </div>

          <div className="form-group">
            <label htmlFor="other-ingredients">Any other ingredients?</label>
            <input
              id="other-ingredients"
              type="text"
              className="text-input"
              value={otherIngredients}
              onChange={e => setOtherIngredients(e.target.value)}
              placeholder="e.g., lime, mint, sugar, bitters"
            />
          </div>

          <div className="action-buttons">
            <button className="btn btn-primary" onClick={() => generateRecipe(false)} disabled={loading}>
              {loading ? 'Crafting...' : 'Craft My Drink'}
            </button>
            <button className="btn btn-secondary" onClick={() => generateRecipe(true)} disabled={loading}>
              {loading ? 'Thinking...' : 'Surprise Me!'}
            </button>
          </div>

          <div className="result-container" aria-live="polite">
            {loading && (
              <div className="loader">
                <div className="spinner"></div>
                <p>{loadingMessage}</p>
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            {recipes && (
              <div className="recipes-grid">
                {recipes.map((recipe, index) => (
                    <div className="recipe-card" key={index}>
                        {recipe.imageUrl ? (
                            <img src={recipe.imageUrl} alt={`A photo of a ${recipe.name} cocktail.`} className="recipe-image" />
                        ) : (
                            <div className="recipe-image-placeholder">
                                <span>Generating Image...</span>
                            </div>
                        )}
                        <h2>{recipe.name}</h2>
                        <p className="description">{recipe.description}</p>
        
                        <h3>Ingredients</h3>
                        <ul className="ingredient-list">
                          {recipe.ingredients.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
        
                        <h3>Instructions</h3>
                        <ol>
                          {recipe.instructions.map((item, i) => <li key={i}>{item}</li>)}
                        </ol>
        
                        {recipe.garnish && (
                            <>
                              <h3>Garnish</h3>
                              <p>{recipe.garnish}</p>
                            </>
                        )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}