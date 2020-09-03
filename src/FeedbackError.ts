/**
 * An error with a user-friendly feedback message.
 */
export class FeedbackError extends Error {
    /**
     * The user-friendly feedback message.
     */
    public feedbackMessage: string;

    /**
     * Constructs a new FeedbackError with a feedback message.
     * @param feedbackMessage the user-friendly feedback message.
     */
    public constructor (feedbackMessage) {
      super(feedbackMessage);
      this.feedbackMessage = feedbackMessage;
    }
}
