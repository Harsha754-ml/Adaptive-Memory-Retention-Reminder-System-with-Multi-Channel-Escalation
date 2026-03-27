class Topic {
  final String id;
  final String topicName;
  final String question;
  final String answer;
  final String sourceType;
  final int retentionScore;
  final String urgencyLevel;
  final bool audioReady;
  final int nextReminderMinutes;

  Topic({
    required this.id,
    required this.topicName,
    required this.question,
    required this.answer,
    required this.sourceType,
    this.retentionScore = 100,
    this.urgencyLevel = 'safe',
    this.audioReady = false,
    this.nextReminderMinutes = 0,
  });

  factory Topic.fromJson(Map<String, dynamic> json) {
    return Topic(
      id: json['id'] ?? '',
      topicName: json['topic_name'] ?? '',
      question: json['question'] ?? '',
      answer: json['answer'] ?? '',
      sourceType: json['source_type'] ?? 'manual',
      retentionScore: json['retention_score'] ?? 100,
      urgencyLevel: json['urgency_level'] ?? 'safe',
      audioReady: json['audio_ready'] ?? false,
      nextReminderMinutes: json['next_reminder_minutes'] ?? 0,
    );
  }
}

class NotificationDetail {
  final String notificationId;
  final String flashcardId;
  final String topicName;
  final String question;
  final int retentionScore;
  final String urgencyLevel;
  final String action;
  final String audioUrl;
  final String summaryText;

  NotificationDetail({
    required this.notificationId,
    required this.flashcardId,
    required this.topicName,
    required this.question,
    required this.retentionScore,
    required this.urgencyLevel,
    required this.action,
    required this.audioUrl,
    required this.summaryText,
  });

  factory NotificationDetail.fromJson(Map<String, dynamic> json) {
    return NotificationDetail(
      notificationId: json['notification_id'] ?? '',
      flashcardId: json['flashcard_id'] ?? '',
      topicName: json['topic_name'] ?? '',
      question: json['question'] ?? '',
      retentionScore: json['retention_score'] ?? 0,
      urgencyLevel: json['urgency_level'] ?? 'safe',
      action: json['action'] ?? 'open_summary',
      audioUrl: json['audio_url'] ?? '',
      summaryText: json['summary_text'] ?? '',
    );
  }
}
