/**
 * Prompts service for managing built-in and custom saved prompts
 * Handles CRUD operations for custom prompts and provides built-in templates
 */

import { SavedPrompt, BuiltInPrompt, CHAT_CONSTANTS } from '../types/chat';

export class PromptsService {
  private readonly storageKey = CHAT_CONSTANTS.STORAGE_KEY;

  /**
   * Get all built-in prompt templates
   */
  getBuiltInPrompts(): BuiltInPrompt[] {
    return [
      {
        id: 'code-generation',
        name: 'Code Generation',
        description: "Test the model's ability to generate code",
        prompt: `Write a Python function that takes a list of numbers and returns the sum of all even numbers in the list. Include error handling and add docstring with examples.

Requirements:
- Handle empty lists
- Handle non-numeric values
- Include type hints
- Add comprehensive docstring`,
        category: 'code',
      },
      {
        id: 'language-translation',
        name: 'Language Translation',
        description: 'Test translation capabilities',
        prompt: `Translate the following text to Spanish, maintaining the original tone and context:

"The quick brown fox jumps over the lazy dog. This sentence contains all letters of the English alphabet and is commonly used for testing fonts and keyboards."

After translation, briefly explain any cultural or linguistic considerations you made during translation.`,
        category: 'translation',
      },
      {
        id: 'text-summarization',
        name: 'Text Summarization',
        description: 'Test summarization and comprehension',
        prompt: `Please summarize the following text in 2-3 bullet points, focusing on the key information:

[Paste your text here to test summarization capabilities]

Then provide a one-sentence summary that captures the main idea.`,
        category: 'analysis',
      },
      {
        id: 'json-response',
        name: 'JSON Response Format',
        description: 'Test structured JSON output',
        prompt: `Create a JSON object representing a fictional book with the following structure:
- title (string)
- author (object with firstName and lastName)
- publishedYear (number)
- genres (array of strings)
- isbn (string)
- pages (number)
- availability (object with inStock boolean and quantity number)

Make sure the JSON is valid and includes realistic sample data.`,
        category: 'format',
      },
      {
        id: 'creative-writing',
        name: 'Creative Writing',
        description: 'Test creative and narrative capabilities',
        prompt: `Write a short story (150-200 words) that includes:
- A character who discovers something unexpected
- A setting that changes during the story
- An object that becomes important to the plot
- An ending with a small twist

Focus on vivid descriptions and emotional engagement.`,
        category: 'general',
      },
      {
        id: 'problem-solving',
        name: 'Problem Solving',
        description: 'Test logical reasoning and problem-solving',
        prompt: `You have a 3-gallon jug and a 5-gallon jug. You need to measure exactly 4 gallons of water. You have access to unlimited water supply. 

Provide step-by-step instructions to solve this problem. Then explain the general principle that makes this solution work.`,
        category: 'analysis',
      },
      {
        id: 'data-analysis',
        name: 'Data Analysis',
        description: 'Test analytical and mathematical capabilities',
        prompt: `Given the following sample data about monthly sales:
January: $15,000
February: $18,500
March: $22,000
April: $19,750
May: $25,500

Analyze this data and provide:
1. The average monthly growth rate
2. The trend direction
3. A prediction for June sales with reasoning
4. One recommendation to improve sales performance`,
        category: 'analysis',
      },
      {
        id: 'roleplay-assistant',
        name: 'Role-Playing Assistant',
        description: 'Test role-playing and persona adoption',
        prompt: `Act as a friendly customer service representative for a tech company. A customer is frustrated because their new smartphone's battery drains quickly. 

Respond to this customer complaint:
"I bought this phone last week and the battery barely lasts 4 hours! This is ridiculous for a $800 device. I want my money back!"

Be empathetic, offer solutions, and try to retain the customer while addressing their concern professionally.`,
        category: 'general',
      },
    ];
  }

  /**
   * Get all custom saved prompts from localStorage
   */
  getUserPrompts(): SavedPrompt[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];

      const prompts = JSON.parse(stored);

      // Validate and convert dates
      return prompts.map((prompt: any) => ({
        ...prompt,
        createdAt: new Date(prompt.createdAt),
        updatedAt: prompt.updatedAt ? new Date(prompt.updatedAt) : undefined,
        isBuiltIn: false, // Ensure user prompts are never marked as built-in
      }));
    } catch (error) {
      console.error('Error loading user prompts:', error);
      return [];
    }
  }

  /**
   * Get all prompts (built-in + custom) organized by category
   */
  getAllPrompts(): { builtIn: BuiltInPrompt[]; custom: SavedPrompt[] } {
    return {
      builtIn: this.getBuiltInPrompts(),
      custom: this.getUserPrompts(),
    };
  }

  /**
   * Save a new custom prompt
   */
  savePrompt(prompt: Omit<SavedPrompt, 'id' | 'isBuiltIn' | 'createdAt'>): SavedPrompt {
    try {
      const userPrompts = this.getUserPrompts();

      // Check for duplicate names
      if (userPrompts.some((p) => p.name.toLowerCase() === prompt.name.toLowerCase())) {
        throw new Error('A prompt with this name already exists');
      }

      const newPrompt: SavedPrompt = {
        ...prompt,
        id: this.generateId(),
        isBuiltIn: false,
        createdAt: new Date(),
      };

      userPrompts.push(newPrompt);
      this.saveToStorage(userPrompts);

      return newPrompt;
    } catch (error) {
      console.error('Error saving prompt:', error);
      throw error;
    }
  }

  /**
   * Update an existing custom prompt
   */
  updatePrompt(
    id: string,
    updates: Partial<Pick<SavedPrompt, 'name' | 'description' | 'prompt'>>,
  ): SavedPrompt {
    try {
      const userPrompts = this.getUserPrompts();
      const index = userPrompts.findIndex((p) => p.id === id);

      if (index === -1) {
        throw new Error('Prompt not found');
      }

      // Check if name is being changed and if it conflicts
      if (updates.name && updates.name !== userPrompts[index].name) {
        const nameExists = userPrompts.some(
          (p, i) => i !== index && p.name.toLowerCase() === updates.name!.toLowerCase(),
        );
        if (nameExists) {
          throw new Error('A prompt with this name already exists');
        }
      }

      const updatedPrompt = {
        ...userPrompts[index],
        ...updates,
        updatedAt: new Date(),
      };

      userPrompts[index] = updatedPrompt;
      this.saveToStorage(userPrompts);

      return updatedPrompt;
    } catch (error) {
      console.error('Error updating prompt:', error);
      throw error;
    }
  }

  /**
   * Delete a custom prompt (cannot delete built-in prompts)
   */
  deletePrompt(id: string): boolean {
    try {
      const userPrompts = this.getUserPrompts();
      const initialLength = userPrompts.length;
      const filteredPrompts = userPrompts.filter((p) => p.id !== id);

      if (filteredPrompts.length === initialLength) {
        return false; // Prompt not found
      }

      this.saveToStorage(filteredPrompts);
      return true;
    } catch (error) {
      console.error('Error deleting prompt:', error);
      throw error;
    }
  }

  /**
   * Get a specific prompt by ID (searches both built-in and custom)
   */
  getPromptById(id: string): BuiltInPrompt | SavedPrompt | null {
    // Check built-in prompts first
    const builtIn = this.getBuiltInPrompts().find((p) => p.id === id);
    if (builtIn) return builtIn;

    // Check custom prompts
    const custom = this.getUserPrompts().find((p) => p.id === id);
    return custom || null;
  }

  /**
   * Search prompts by name or description
   */
  searchPrompts(query: string): { builtIn: BuiltInPrompt[]; custom: SavedPrompt[] } {
    const lowerQuery = query.toLowerCase();

    const builtIn = this.getBuiltInPrompts().filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.prompt.toLowerCase().includes(lowerQuery),
    );

    const custom = this.getUserPrompts().filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.description && p.description.toLowerCase().includes(lowerQuery)) ||
        p.prompt.toLowerCase().includes(lowerQuery),
    );

    return { builtIn, custom };
  }

  /**
   * Get prompts by category (built-in only)
   */
  getPromptsByCategory(category: BuiltInPrompt['category']): BuiltInPrompt[] {
    return this.getBuiltInPrompts().filter((p) => p.category === category);
  }

  /**
   * Export custom prompts as JSON
   */
  exportCustomPrompts(): string {
    const userPrompts = this.getUserPrompts();
    return JSON.stringify(userPrompts, null, 2);
  }

  /**
   * Import custom prompts from JSON
   */
  importCustomPrompts(jsonData: string, replaceExisting = false): number {
    try {
      const importedPrompts = JSON.parse(jsonData);

      if (!Array.isArray(importedPrompts)) {
        throw new Error('Invalid format: expected an array of prompts');
      }

      const existingPrompts = replaceExisting ? [] : this.getUserPrompts();
      let importedCount = 0;

      for (const prompt of importedPrompts) {
        if (this.isValidPromptStructure(prompt)) {
          // Generate new ID and update timestamps
          const newPrompt: SavedPrompt = {
            id: this.generateId(),
            name: prompt.name,
            description: prompt.description,
            prompt: prompt.prompt,
            isBuiltIn: false,
            createdAt: new Date(),
            updatedAt: undefined,
          };

          // Check for duplicates by name
          if (!existingPrompts.some((p) => p.name.toLowerCase() === newPrompt.name.toLowerCase())) {
            existingPrompts.push(newPrompt);
            importedCount++;
          }
        }
      }

      this.saveToStorage(existingPrompts);
      return importedCount;
    } catch (error) {
      console.error('Error importing prompts:', error);
      throw error;
    }
  }

  /**
   * Clear all custom prompts
   */
  clearCustomPrompts(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error clearing custom prompts:', error);
      throw error;
    }
  }

  /**
   * Get statistics about prompts
   */
  getStatistics(): {
    builtInCount: number;
    customCount: number;
    totalCount: number;
    categoryCounts: Record<string, number>;
  } {
    const builtIn = this.getBuiltInPrompts();
    const custom = this.getUserPrompts();

    const categoryCounts = builtIn.reduce(
      (acc, prompt) => {
        acc[prompt.category] = (acc[prompt.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      builtInCount: builtIn.length,
      customCount: custom.length,
      totalCount: builtIn.length + custom.length,
      categoryCounts,
    };
  }

  /**
   * Generate a unique ID for prompts
   */
  private generateId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save prompts to localStorage
   */
  private saveToStorage(prompts: SavedPrompt[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(prompts));
  }

  /**
   * Validate prompt structure for import
   */
  private isValidPromptStructure(obj: any): boolean {
    return (
      typeof obj === 'object' &&
      typeof obj.name === 'string' &&
      typeof obj.prompt === 'string' &&
      obj.name.trim().length > 0 &&
      obj.prompt.trim().length > 0
    );
  }
}

// Export singleton instance
export const promptsService = new PromptsService();
