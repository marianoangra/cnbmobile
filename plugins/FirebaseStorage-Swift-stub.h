/**
 * FirebaseStorage-Swift.h - ObjC stub for use_modular_headers! builds
 *
 * Firebase Storage 11+ é 100% Swift. Com use_frameworks! o compilador Swift
 * gera este arquivo automaticamente. Sem use_frameworks!, ele não é gerado.
 *
 * Este stub declara manualmente os tipos ObjC necessários para que
 * RNFBStorageModule.m e RNFBStorageCommon.m compilem corretamente.
 *
 * As implementações reais estão no runtime Swift — estas são apenas as
 * declarações de compile time para o compilador ObjC.
 */

#ifndef FirebaseStorage_Swift_h
#define FirebaseStorage_Swift_h

#ifdef __OBJC__

#import <Foundation/Foundation.h>
#import <FirebaseCore/FirebaseCore.h>

NS_ASSUME_NONNULL_BEGIN

// ---------------------------------------------------------------------------
// MARK: - Enums
// ---------------------------------------------------------------------------

typedef NS_ENUM(NSInteger, FIRStorageTaskStatus) {
    FIRStorageTaskStatusUnknown   = 0,
    FIRStorageTaskStatusResume    = 1,
    FIRStorageTaskStatusPause     = 2,
    FIRStorageTaskStatusProgress  = 3,
    FIRStorageTaskStatusSuccess   = 4,
    FIRStorageTaskStatusFailure   = 5,
} NS_SWIFT_NAME(StorageTaskStatus);

typedef NS_ENUM(NSInteger, FIRStorageErrorCode) {
    FIRStorageErrorCodeUnknown              = -13000,
    FIRStorageErrorCodeObjectNotFound       = -13010,
    FIRStorageErrorCodeBucketNotFound       = -13011,
    FIRStorageErrorCodeProjectNotFound      = -13012,
    FIRStorageErrorCodeQuotaExceeded        = -13013,
    FIRStorageErrorCodeUnauthenticated      = -13020,
    FIRStorageErrorCodeUnauthorized         = -13021,
    FIRStorageErrorCodeRetryLimitExceeded   = -13030,
    FIRStorageErrorCodeNonMatchingChecksum  = -13031,
    FIRStorageErrorCodeDownloadSizeExceeded = -13032,
    FIRStorageErrorCodeCancelled            = -13040,
} NS_SWIFT_NAME(StorageErrorCode);

// ---------------------------------------------------------------------------
// MARK: - Forward Declarations
// ---------------------------------------------------------------------------

@class FIRStorage;
@class FIRStorageReference;
@class FIRStorageMetadata;
@class FIRStorageTaskSnapshot;
@class FIRStorageDownloadTask;
@class FIRStorageUploadTask;
@class FIRStorageListResult;
@class FIRStorageObservableTask;

// Handle for task observers
#ifndef FIRStorageHandle
typedef NSString *FIRStorageHandle NS_SWIFT_NAME(StorageHandle);
#endif

// ---------------------------------------------------------------------------
// MARK: - Protocol
// ---------------------------------------------------------------------------

@protocol FIRStorageTaskManagement <NSObject>
- (void)enqueue;
@optional
- (void)pause;
- (void)cancel;
- (void)resume;
@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorageMetadata
// ---------------------------------------------------------------------------

@interface FIRStorageMetadata : NSObject

@property (nonatomic, readonly, copy) NSString *bucket;
@property (nonatomic, copy, nullable) NSString *cacheControl;
@property (nonatomic, copy, nullable) NSString *contentDisposition;
@property (nonatomic, copy, nullable) NSString *contentEncoding;
@property (nonatomic, copy, nullable) NSString *contentLanguage;
@property (nonatomic, copy, nullable) NSString *contentType;
@property (nonatomic, readonly, copy, nullable) NSString *md5Hash;
@property (nonatomic, readonly) int64_t generation;
@property (nonatomic, copy, nullable) NSDictionary<NSString *, NSString *> *customMetadata;
@property (nonatomic, readonly) int64_t metageneration;
@property (nonatomic, copy, nullable) NSString *name;
@property (nonatomic, copy, nullable) NSString *path;
@property (nonatomic, readonly) int64_t size;
@property (nonatomic, readonly, strong, nullable) NSDate *timeCreated;
@property (nonatomic, readonly, strong, nullable) NSDate *updated;
@property (nonatomic, readonly) BOOL isFile;
@property (nonatomic, readonly) BOOL isFolder;
@property (nonatomic, readonly, strong, nullable) FIRStorageReference *storageReference;

- (instancetype)init;
- (instancetype)initWithDictionary:(NSDictionary<NSString *, id> *)dictionary;
- (NSDictionary<NSString *, id> *)dictionaryRepresentation;

@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorageTaskSnapshot
// ---------------------------------------------------------------------------

@interface FIRStorageTaskSnapshot : NSObject

@property (nonatomic, readonly, strong) id task;
@property (nonatomic, readonly, strong, nullable) FIRStorageMetadata *metadata;
@property (nonatomic, readonly, strong) FIRStorageReference *reference;
@property (nonatomic, readonly, strong, nullable) NSProgress *progress;
@property (nonatomic, readonly, strong, nullable) NSError *error;
@property (nonatomic, readonly) FIRStorageTaskStatus status;

@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorageTask
// ---------------------------------------------------------------------------

@interface FIRStorageTask : NSObject

@property (nonatomic, readonly, strong) FIRStorageTaskSnapshot *snapshot;

@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorageObservableTask
// ---------------------------------------------------------------------------

@interface FIRStorageObservableTask : FIRStorageTask

- (FIRStorageHandle)observeStatus:(FIRStorageTaskStatus)status
                          handler:(void (^)(FIRStorageTaskSnapshot *snapshot))observer
    NS_SWIFT_NAME(observe(_:handler:));

- (void)removeObserverWithHandle:(FIRStorageHandle)handle;
- (void)removeAllObserversForStatus:(FIRStorageTaskStatus)status;
- (void)removeAllObservers;

@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorageDownloadTask
// ---------------------------------------------------------------------------

@interface FIRStorageDownloadTask : FIRStorageObservableTask <FIRStorageTaskManagement>

- (void)enqueue;
- (void)pause;
- (void)cancel;
- (void)resume;

@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorageUploadTask
// ---------------------------------------------------------------------------

@interface FIRStorageUploadTask : FIRStorageObservableTask <FIRStorageTaskManagement>

- (void)enqueue;
- (void)pause;
- (void)cancel;
- (void)resume;

@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorageListResult
// ---------------------------------------------------------------------------

@interface FIRStorageListResult : NSObject

@property (nonatomic, readonly, copy) NSArray<FIRStorageReference *> *prefixes;
@property (nonatomic, readonly, copy) NSArray<FIRStorageReference *> *items;
@property (nonatomic, readonly, copy, nullable) NSString *pageToken;

@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorageReference
// ---------------------------------------------------------------------------

@interface FIRStorageReference : NSObject

@property (nonatomic, readonly, strong) FIRStorage *storage;
@property (nonatomic, readonly, copy) NSString *bucket;
@property (nonatomic, readonly, copy) NSString *fullPath;
@property (nonatomic, readonly, copy) NSString *name;

- (FIRStorageReference *)root;
- (nullable FIRStorageReference *)parent;
- (FIRStorageReference *)child:(NSString *)path NS_SWIFT_NAME(child(_:));

// Upload
- (FIRStorageUploadTask *)putData:(NSData *)uploadData
                         metadata:(nullable FIRStorageMetadata *)metadata
    NS_SWIFT_NAME(putData(_:metadata:));

- (FIRStorageUploadTask *)putData:(NSData *)uploadData
                         metadata:(nullable FIRStorageMetadata *)metadata
                       completion:(nullable void (^)(FIRStorageMetadata *_Nullable,
                                                     NSError *_Nullable))completion
    NS_SWIFT_NAME(putData(_:metadata:completion:));

- (FIRStorageUploadTask *)putFile:(NSURL *)fileURL
                         metadata:(nullable FIRStorageMetadata *)metadata
    NS_SWIFT_NAME(putFile(from:metadata:));

- (FIRStorageUploadTask *)putFile:(NSURL *)fileURL
                         metadata:(nullable FIRStorageMetadata *)metadata
                       completion:(nullable void (^)(FIRStorageMetadata *_Nullable,
                                                     NSError *_Nullable))completion
    NS_SWIFT_NAME(putFile(from:metadata:completion:));

// Download
- (FIRStorageDownloadTask *)dataWithMaxSize:(int64_t)size
                                 completion:(void (^)(NSData *_Nullable,
                                                      NSError *_Nullable))completion
    NS_SWIFT_NAME(getData(maxSize:completion:));

- (FIRStorageDownloadTask *)writeToFile:(NSURL *)fileURL
    NS_SWIFT_NAME(write(toFile:));

- (FIRStorageDownloadTask *)writeToFile:(NSURL *)fileURL
                             completion:(nullable void (^)(NSURL *_Nullable,
                                                           NSError *_Nullable))completion
    NS_SWIFT_NAME(write(toFile:completion:));

- (void)downloadURLWithCompletion:(void (^)(NSURL *_Nullable,
                                            NSError *_Nullable))completion
    NS_SWIFT_NAME(downloadURL(completion:));

// Metadata
- (void)metadataWithCompletion:(void (^)(FIRStorageMetadata *_Nullable,
                                         NSError *_Nullable))completion
    NS_SWIFT_NAME(getMetadata(completion:));

- (void)updateMetadata:(FIRStorageMetadata *)metadata
            completion:(nullable void (^)(FIRStorageMetadata *_Nullable,
                                          NSError *_Nullable))completion
    NS_SWIFT_NAME(updateMetadata(_:completion:));

// Delete
- (void)deleteWithCompletion:(nullable void (^)(NSError *_Nullable))completion
    NS_SWIFT_NAME(delete(completion:));

// List
- (void)listAllWithCompletion:(void (^)(FIRStorageListResult *,
                                        NSError *_Nullable))completion
    NS_SWIFT_NAME(listAll(completion:));

- (void)listWithMaxResults:(int64_t)maxResults
                completion:(void (^)(FIRStorageListResult *,
                                     NSError *_Nullable))completion
    NS_SWIFT_NAME(list(maxResults:completion:));

- (void)listWithMaxResults:(int64_t)maxResults
                 pageToken:(NSString *)pageToken
                completion:(void (^)(FIRStorageListResult *,
                                     NSError *_Nullable))completion
    NS_SWIFT_NAME(list(maxResults:pageToken:completion:));

@end

// ---------------------------------------------------------------------------
// MARK: - FIRStorage
// ---------------------------------------------------------------------------

@interface FIRStorage : NSObject

+ (FIRStorage *)storage NS_SWIFT_NAME(storage());
+ (FIRStorage *)storageWithURL:(NSString *)url NS_SWIFT_NAME(storage(url:));
+ (FIRStorage *)storageForApp:(FIRApp *)app NS_SWIFT_NAME(storage(app:));
+ (FIRStorage *)storageForApp:(FIRApp *)app
                          URL:(nullable NSString *)url NS_SWIFT_NAME(storage(app:url:));

@property (nonatomic, readonly, strong) FIRApp *app;
@property (nonatomic) NSTimeInterval maxUploadRetryTime;
@property (nonatomic) NSTimeInterval maxDownloadRetryTime;
@property (nonatomic) NSTimeInterval maxOperationRetryTime;

- (FIRStorageReference *)reference NS_SWIFT_NAME(reference());
- (FIRStorageReference *)referenceForURL:(NSString *)url NS_SWIFT_NAME(reference(forURL:));
- (FIRStorageReference *)referenceWithPath:(NSString *)path NS_SWIFT_NAME(reference(withPath:));
- (void)useEmulatorWithHost:(NSString *)host port:(NSInteger)port NS_SWIFT_NAME(useEmulator(withHost:port:));

@end

NS_ASSUME_NONNULL_END

#endif // __OBJC__
#endif // FirebaseStorage_Swift_h
