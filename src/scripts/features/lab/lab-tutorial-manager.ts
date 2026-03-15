import type { LabLesson, LabStep } from './lab-types';

export class LabTutorialManager {
  private lessonIndex = 0;
  private stepIndex = 0;

  constructor(private lessons: LabLesson[]) {}

  public getProgress() {
    return {
      currentLesson: this.lessonIndex,
      totalLessons: this.lessons.length,
      currentStep: this.stepIndex,
      percentage: Math.round((this.lessonIndex / this.lessons.length) * 100)
    };
  }

  public currentLesson(): LabLesson | undefined {
    return this.lessons[this.lessonIndex];
  }

  public currentStep(): LabStep | undefined {
    return this.currentLesson()?.steps[this.stepIndex];
  }

  public advance(): boolean {
    const lesson = this.currentLesson();
    if (!lesson) return false;

    this.stepIndex++;
    if (this.stepIndex >= lesson.steps.length) {
      this.lessonIndex++;
      this.stepIndex = 0;
      return true; // Moved to next lesson
    }
    return false; // Staying in same lesson
  }

  public isComplete(): boolean {
    return this.lessonIndex >= this.lessons.length;
  }

  public skip() {
    this.advance();
  }

  public resetIndices() {
    this.lessonIndex = 0;
    this.stepIndex = 0;
  }
}
